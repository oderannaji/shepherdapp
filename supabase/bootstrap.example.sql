-- Run only after reviewing/applying the Shepherd migration in the intended project.
-- Replace this example email with your existing, confirmed administrator account.
-- Creates one organisation and one membership; fails rather than repeating a bootstrap.
do $$
declare
  admin_email text := 'REPLACE_WITH_CONFIRMED_ADMIN_EMAIL';
  admin_id uuid;
  organisation uuid;
begin
  select id into admin_id from auth.users where lower(email) = lower(admin_email) and email_confirmed_at is not null;
  if admin_id is null then raise exception 'Create and confirm the administrator account first'; end if;
  if exists (select 1 from public.shepherd_memberships where user_id = admin_id) then
    raise exception 'This account already has a membership; review existing organisations before proceeding';
  end if;
  insert into public.shepherd_organisations (name) values ('Dominion City Manchester') returning id into organisation;
  insert into public.shepherd_memberships (organisation_id, user_id, display_name, role)
    values (organisation, admin_id, 'Church administrator', 'admin');
end;
$$;
