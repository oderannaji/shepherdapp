-- Additive, namespaced tables: does not modify an existing application's tables.
create schema shepherd_private;
revoke all on schema shepherd_private from public, anon, authenticated;

create table public.shepherd_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 140)
);
create table public.shepherd_memberships (
  organisation_id uuid references public.shepherd_organisations not null,
  user_id uuid references auth.users not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 140),
  role text not null check (role in ('admin', 'volunteer')),
  active boolean not null default true,
  primary key (organisation_id, user_id)
);
create table public.shepherd_people (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.shepherd_organisations,
  full_name text not null check (length(btrim(full_name)) between 1 and 140),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  owner_user_id uuid not null,
  outcome text not null default 'No answer' check (outcome in ('Reached', 'No answer', 'Callback', 'Will return', 'Wrong number', 'Do not contact')),
  callback_on date,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  unique (organisation_id, id),
  foreign key (organisation_id, owner_user_id) references public.shepherd_memberships (organisation_id, user_id),
  check ((outcome = 'Callback' and callback_on is not null) or (outcome <> 'Callback' and callback_on is null))
);
create index shepherd_people_owner on public.shepherd_people (organisation_id, owner_user_id);
create table public.shepherd_contact_attempts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  person_id uuid not null,
  actor_id uuid not null,
  actor_name text not null,
  request_id uuid not null,
  submitted_revision integer not null,
  outcome text not null,
  callback_on date,
  note text not null check (length(note) <= 4000),
  created_at timestamptz not null default now(),
  foreign key (organisation_id, person_id) references public.shepherd_people (organisation_id, id),
  foreign key (organisation_id, actor_id) references public.shepherd_memberships (organisation_id, user_id),
  unique (organisation_id, actor_id, request_id)
);
create index shepherd_attempts_person on public.shepherd_contact_attempts (person_id, created_at desc);
create table public.shepherd_audit_events (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.shepherd_organisations,
  actor_id uuid not null references auth.users,
  person_id uuid not null references public.shepherd_people,
  action text not null,
  revision integer not null,
  created_at timestamptz not null default now()
);

-- Membership is provisioned by a trusted operator, never by a browser role selector.
-- The membership check is made on every request, not taken from stale JWT roles.
create function shepherd_private.has_access(org uuid, owner_id uuid default null, admin_only boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shepherd_memberships m join auth.users u on u.id = m.user_id
    where m.organisation_id = org and m.user_id = auth.uid() and m.active
      and u.email_confirmed_at is not null
      and (
        (m.role = 'admin' and auth.jwt()->>'aal' = 'aal2')
        or (not admin_only and m.role = 'volunteer' and (owner_id is null or owner_id = auth.uid()))
      )
  );
$$;
revoke all on function shepherd_private.has_access(uuid, uuid, boolean) from public;
grant usage on schema shepherd_private to authenticated;
grant execute on function shepherd_private.has_access(uuid, uuid, boolean) to authenticated;

alter table public.shepherd_organisations enable row level security;
alter table public.shepherd_memberships enable row level security;
alter table public.shepherd_people enable row level security;
alter table public.shepherd_contact_attempts enable row level security;
alter table public.shepherd_audit_events enable row level security;
revoke all on public.shepherd_organisations, public.shepherd_memberships, public.shepherd_people, public.shepherd_contact_attempts, public.shepherd_audit_events from anon, authenticated;
grant select on public.shepherd_organisations, public.shepherd_memberships, public.shepherd_people, public.shepherd_contact_attempts to authenticated;
create policy organisation_read on public.shepherd_organisations for select to authenticated using (shepherd_private.has_access(id));
-- Self-read allows the UI to request MFA before opening an admin workspace.
create policy membership_read on public.shepherd_memberships for select to authenticated using (
  (user_id = auth.uid() and active) or shepherd_private.has_access(organisation_id, null, true)
);
create policy people_read on public.shepherd_people for select to authenticated using (shepherd_private.has_access(organisation_id, owner_user_id));
create policy attempts_read on public.shepherd_contact_attempts for select to authenticated using (
  exists (select 1 from public.shepherd_people p where p.id = person_id and p.organisation_id = shepherd_contact_attempts.organisation_id)
);

create function public.shepherd_today() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/London')::date;
$$;
revoke all on function public.shepherd_today() from public;
grant execute on function public.shepherd_today() to authenticated;

create function public.shepherd_record_follow_up(
  p_person_id uuid, p_revision integer, p_request_id uuid,
  p_outcome text, p_callback_on date, p_note text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  person public.shepherd_people;
  previous public.shepherd_contact_attempts;
  author text;
begin
  -- Lock serialises saves, retries and edits from other browser sessions.
  select * into person from public.shepherd_people where id = p_person_id for update;
  if person.id is null or not shepherd_private.has_access(person.organisation_id, person.owner_user_id) then
    raise exception 'Contact unavailable or access removed' using errcode = '42501';
  end if;
  if p_request_id is null or p_revision is null or p_note is null or length(p_note) > 4000
    or p_outcome is null or p_outcome not in ('Reached', 'No answer', 'Callback', 'Will return', 'Wrong number', 'Do not contact')
    or (p_outcome = 'Callback' and p_callback_on is null)
    or (p_outcome <> 'Callback' and p_callback_on is not null) then
    raise exception 'Invalid follow-up details' using errcode = '22023';
  end if;
  select * into previous from public.shepherd_contact_attempts
    where organisation_id = person.organisation_id and actor_id = auth.uid() and request_id = p_request_id;
  if previous.id is not null then
    if previous.person_id = p_person_id and previous.submitted_revision = p_revision
      and previous.outcome = p_outcome and previous.callback_on is not distinct from p_callback_on
      and previous.note = btrim(p_note) then return; end if;
    raise exception 'Retry does not match original submission' using errcode = '22023';
  end if;
  if person.revision <> p_revision then
    raise exception 'This contact changed. Reload before saving.' using errcode = '40001';
  end if;
  select display_name into author from public.shepherd_memberships
    where organisation_id = person.organisation_id and user_id = auth.uid();
  update public.shepherd_people set outcome = p_outcome, callback_on = p_callback_on, revision = revision + 1 where id = person.id;
  insert into public.shepherd_contact_attempts
    (organisation_id, person_id, actor_id, actor_name, request_id, submitted_revision, outcome, callback_on, note)
    values (person.organisation_id, person.id, auth.uid(), author, p_request_id, p_revision, p_outcome, p_callback_on, btrim(p_note));
  insert into public.shepherd_audit_events (organisation_id, actor_id, person_id, action, revision)
    values (person.organisation_id, auth.uid(), person.id, 'follow_up_recorded', person.revision + 1);
end;
$$;
revoke all on function public.shepherd_record_follow_up(uuid, integer, uuid, text, date, text) from public;
grant execute on function public.shepherd_record_follow_up(uuid, integer, uuid, text, date, text) to authenticated;

create function public.shepherd_create_person(p_organisation_id uuid, p_full_name text, p_phone_e164 text, p_owner_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not shepherd_private.has_access(p_organisation_id, null, true) then
    raise exception 'An active administrator with MFA is required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shepherd_memberships where organisation_id = p_organisation_id and user_id = p_owner_user_id and active) then
    raise exception 'Select an active owner in this organisation' using errcode = '22023';
  end if;
  insert into public.shepherd_people (organisation_id, full_name, phone_e164, owner_user_id)
    values (p_organisation_id, btrim(p_full_name), nullif(btrim(p_phone_e164), ''), p_owner_user_id) returning id into new_id;
  insert into public.shepherd_audit_events (organisation_id, actor_id, person_id, action, revision)
    values (p_organisation_id, auth.uid(), new_id, 'person_created', 1);
  return new_id;
end;
$$;
revoke all on function public.shepherd_create_person(uuid, text, text, uuid) from public;
grant execute on function public.shepherd_create_person(uuid, text, text, uuid) to authenticated;
