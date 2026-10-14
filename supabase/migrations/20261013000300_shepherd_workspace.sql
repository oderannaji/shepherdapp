-- Persistent church workflows. All mutations use authenticated, validated RPCs.
alter table public.shepherd_people add column merged_into uuid references public.shepherd_people;
alter table public.shepherd_audit_events alter column person_id drop not null;
alter table public.shepherd_audit_events add column details jsonb not null default '{}';
create table public.shepherd_services (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.shepherd_organisations,
 service_date date not null, title text not null check(length(btrim(title)) between 1 and 140),
 unique(organisation_id,id), unique(organisation_id,service_date)
);
create table public.shepherd_expected_lists (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null, service_id uuid not null,
 author_id uuid not null, note text not null default '' check(length(note)<=1000),
 state text not null check(state in ('published','results')), revision integer not null default 1,
 created_at timestamptz not null default now(),
 unique(organisation_id,id), unique(organisation_id,service_id,author_id),
 foreign key(organisation_id,service_id) references public.shepherd_services(organisation_id,id),
 foreign key(organisation_id,author_id) references public.shepherd_memberships(organisation_id,user_id)
);
create table public.shepherd_expected_entries (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null, list_id uuid not null, person_id uuid not null,
 attendance text not null default 'unknown' check(attendance in ('unknown','came','absent')), late boolean not null default false,
 unique(list_id,person_id), foreign key(organisation_id,list_id) references public.shepherd_expected_lists(organisation_id,id),
 foreign key(organisation_id,person_id) references public.shepherd_people(organisation_id,id)
);
create table public.shepherd_attendance_observations (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null, service_id uuid not null, person_id uuid not null,
 source text not null check(source in ('expected','register','import')), source_id uuid not null,
 status text not null check(status in ('unknown','came','absent')), actor_id uuid not null references auth.users,
 created_at timestamptz not null default now(), unique(source,source_id,person_id),
 foreign key(organisation_id,service_id) references public.shepherd_services(organisation_id,id),
 foreign key(organisation_id,person_id) references public.shepherd_people(organisation_id,id)
);
create table public.shepherd_attendance_resolutions (
 organisation_id uuid not null, service_id uuid not null, person_id uuid not null, status text not null check(status in ('came','absent','unknown')),
 reason text not null check(length(btrim(reason)) between 3 and 1000), actor_id uuid not null references auth.users,
 updated_at timestamptz not null default now(), primary key(service_id,person_id),
 foreign key(organisation_id,service_id) references public.shepherd_services(organisation_id,id),
 foreign key(organisation_id,person_id) references public.shepherd_people(organisation_id,id)
);
create table public.shepherd_recovery_assignments (
 organisation_id uuid not null, service_id uuid not null, person_id uuid not null, caller_id uuid not null,
 primary key(service_id,person_id), foreign key(organisation_id,service_id) references public.shepherd_services(organisation_id,id),
 foreign key(organisation_id,person_id) references public.shepherd_people(organisation_id,id),
 foreign key(organisation_id,caller_id) references public.shepherd_memberships(organisation_id,user_id)
);
create table shepherd_private.requests (
 organisation_id uuid not null, actor_id uuid not null, request_id uuid not null, action text not null, payload jsonb not null, result jsonb,
 primary key(organisation_id,actor_id,request_id)
);
revoke all on shepherd_private.requests from public,anon,authenticated;

create function shepherd_private.person_access(person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shepherd_people p where p.id=person and p.merged_into is null and
 (shepherd_private.has_access(p.organisation_id,p.owner_user_id) or
 (shepherd_private.has_access(p.organisation_id) and exists(
 select 1 from public.shepherd_recovery_assignments a join public.shepherd_services s on s.id=a.service_id
 where a.person_id=p.id and a.caller_id=auth.uid() and public.shepherd_today() between s.service_date-6 and s.service_date+6))));
$$;
drop policy people_read on public.shepherd_people;
create policy people_read on public.shepherd_people for select to authenticated using(shepherd_private.person_access(id));
-- Contact RPC keeps its idempotency and revision checks; change only the permission predicate.
do $$ declare body text; begin
 select pg_get_functiondef('public.shepherd_record_follow_up(uuid,integer,uuid,text,date,text)'::regprocedure) into body;
 body:=replace(body,'not shepherd_private.has_access(person.organisation_id, person.owner_user_id)','not shepherd_private.person_access(person.id)');
 execute body;
end $$;

create function public.shepherd_is_admin(p_organisation_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select shepherd_private.has_access(p_organisation_id,null,true);
$$;
create function public.shepherd_members(p_organisation_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not shepherd_private.has_access(p_organisation_id,null,true) then raise exception 'Administrator access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',m.display_name,'role',m.role,'active',m.active,'email',u.email,'confirmed',u.email_confirmed_at is not null) order by m.display_name)
 from public.shepherd_memberships m join auth.users u on u.id=m.user_id where m.organisation_id=p_organisation_id),'[]');
end $$;
-- Called with the administrator's JWT after the server creates/invites the auth user.
create function public.shepherd_grant_member(p_organisation_id uuid,p_user_id uuid,p_email text,p_name text,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text,0));
 if not shepherd_private.has_access(p_organisation_id,null,true) then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_role is null or p_role not in ('admin','volunteer') or length(btrim(p_name)) not between 1 and 140 or not exists(select 1 from auth.users where id=p_user_id and lower(email)=lower(btrim(p_email))) then raise exception 'Invalid account details' using errcode='22023'; end if;
 -- Reinviting must never silently reactivate an account or alter its role.
 if exists(select 1 from public.shepherd_memberships where organisation_id=p_organisation_id and user_id=p_user_id) then return; end if;
 insert into public.shepherd_memberships values(p_organisation_id,p_user_id,btrim(p_name),p_role,true);
 insert into public.shepherd_audit_events(organisation_id,actor_id,action,revision,details) values(p_organisation_id,auth.uid(),'member_invited',1,jsonb_build_object('user_id',p_user_id,'role',p_role));
end $$;

create function shepherd_private.attendance(org uuid,service uuid) returns table(person_id uuid,status text,conflict boolean,observations jsonb) language sql stable security definer set search_path='' as $$
 select p.id,coalesce(r.status,case when count(distinct o.status) filter(where o.status<>'unknown')=1 then max(o.status) filter(where o.status<>'unknown') else 'unknown' end),
 r.person_id is null and count(distinct o.status) filter(where o.status<>'unknown')>1,
 coalesce(jsonb_agg(jsonb_build_object('source',o.source,'status',o.status,'actor_id',o.actor_id)) filter(where o.id is not null),'[]')
 from public.shepherd_people p left join public.shepherd_attendance_observations o on o.person_id=p.id and o.service_id=service
 left join public.shepherd_attendance_resolutions r on r.person_id=p.id and r.service_id=service
 where p.organisation_id=org and p.merged_into is null group by p.id,r.status,r.person_id;
$$;
create function public.shepherd_attendance(p_organisation_id uuid,p_service_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not shepherd_private.has_access(p_organisation_id) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.shepherd_services where id=p_service_id and organisation_id=p_organisation_id) then raise exception 'Service unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('person_id',a.person_id,'full_name',p.full_name,'status',a.status,'conflict',a.conflict,'observations',case when shepherd_private.has_access(p_organisation_id,null,true) then a.observations else '[]'::jsonb end))
 from shepherd_private.attendance(p_organisation_id,p_service_id) a join public.shepherd_people p on p.id=a.person_id where shepherd_private.person_access(p.id)),'[]');
end $$;
create function public.shepherd_team_totals(p_organisation_id uuid,p_service_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not shepherd_private.has_access(p_organisation_id) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 return jsonb_build_object('expected',(select count(distinct e.person_id) from public.shepherd_expected_entries e join public.shepherd_expected_lists l on l.id=e.list_id where l.organisation_id=p_organisation_id and l.service_id=p_service_id and not e.late),
 'came',(select count(*) from shepherd_private.attendance(p_organisation_id,p_service_id) where status='came'),
 'conflicts',(select count(*) from shepherd_private.attendance(p_organisation_id,p_service_id) where conflict),
 'posts',coalesce((select jsonb_agg(x) from (select l.id,m.display_name,l.state,count(e.id) filter(where not e.late) as expected,count(e.id) filter(where e.attendance='came') as came
 from public.shepherd_expected_lists l join public.shepherd_memberships m on m.organisation_id=l.organisation_id and m.user_id=l.author_id
 left join public.shepherd_expected_entries e on e.list_id=l.id where l.organisation_id=p_organisation_id and l.service_id=p_service_id group by l.id,m.display_name) x),'[]'));
end $$;

-- Shared read policies; no direct frontend writes, including audit history.
do $$ declare t text; begin
 foreach t in array array['shepherd_services','shepherd_expected_lists','shepherd_expected_entries','shepherd_attendance_observations','shepherd_attendance_resolutions','shepherd_recovery_assignments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy service_read on public.shepherd_services for select to authenticated using(shepherd_private.has_access(organisation_id));
create policy expected_read on public.shepherd_expected_lists for select to authenticated using(shepherd_private.has_access(organisation_id,author_id));
create policy entries_read on public.shepherd_expected_entries for select to authenticated using(exists(select 1 from public.shepherd_expected_lists where id=list_id));
create policy observation_read on public.shepherd_attendance_observations for select to authenticated using(shepherd_private.has_access(organisation_id,null,true));
create policy resolution_read on public.shepherd_attendance_resolutions for select to authenticated using(shepherd_private.has_access(organisation_id,null,true));
create policy recovery_read on public.shepherd_recovery_assignments for select to authenticated using(shepherd_private.person_access(person_id));
grant select on public.shepherd_audit_events to authenticated;
create policy audit_read on public.shepherd_audit_events for select to authenticated using(shepherd_private.has_access(organisation_id,null,true));

create function public.shepherd_save_expected(p_organisation_id uuid,p_service_id uuid,p_list_id uuid,p_revision integer,p_request_id uuid,p_note text,p_entries jsonb,p_results boolean,p_reason text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare l public.shepherd_expected_lists; prev shepherd_private.requests; item jsonb; person uuid; result uuid; payload jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text,0));
 if not shepherd_private.has_access(p_organisation_id) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if p_request_id is null or p_list_id is null or p_revision is null or p_results is null or p_note is null or length(p_note)>1000 or jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries)>500 then raise exception 'Invalid list' using errcode='22023'; end if;
 payload:=jsonb_build_object('service',p_service_id,'list',p_list_id,'revision',p_revision,'note',p_note,'entries',p_entries,'results',p_results,'reason',p_reason);
 select * into prev from shepherd_private.requests where organisation_id=p_organisation_id and actor_id=auth.uid() and request_id=p_request_id;
 if found then
 if prev.action<>'expected' or prev.payload<>payload then raise exception 'Retry changed' using errcode='22023'; end if;
 return (prev.result->>'id')::uuid; end if;
 if not exists(select 1 from public.shepherd_services where id=p_service_id and organisation_id=p_organisation_id) then raise exception 'Service unavailable' using errcode='42501'; end if;
 select * into l from public.shepherd_expected_lists where id=p_list_id for update;
 if found then
 if l.organisation_id<>p_organisation_id or l.service_id<>p_service_id or not shepherd_private.has_access(p_organisation_id,l.author_id) then raise exception 'List unavailable' using errcode='42501'; end if;
 if l.revision<>p_revision then raise exception 'List changed. Reload before saving.' using errcode='40001'; end if;
 if l.state='results' or l.author_id<>auth.uid() then
 if not shepherd_private.has_access(p_organisation_id,null,true) or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Posted results require an administrator and correction reason' using errcode='42501'; end if;
 end if;
 else
 if p_revision<>0 then raise exception 'List unavailable' using errcode='40001'; end if;
 insert into public.shepherd_expected_lists(id,organisation_id,service_id,author_id,state) values(p_list_id,p_organisation_id,p_service_id,auth.uid(),'published') returning * into l;
 end if;
 if (select count(*)<>count(distinct value->>'person_id') from jsonb_array_elements(p_entries)) then raise exception 'Duplicate person in list' using errcode='22023'; end if;
 -- Delete only after validating access to every entry; transaction rollback protects all changes.
 for item in select * from jsonb_array_elements(p_entries) loop
 person:=(item->>'person_id')::uuid;
 if not exists(select 1 from public.shepherd_people where id=person and organisation_id=p_organisation_id and merged_into is null) or not shepherd_private.person_access(person) then raise exception 'Person unavailable' using errcode='42501'; end if;
 if item->>'attendance' is null or item->>'attendance' not in ('unknown','came','absent') then raise exception 'Invalid attendance' using errcode='22023'; end if;
 if exists(select 1 from public.shepherd_expected_entries where list_id=l.id and person_id=person and not late) and coalesce((item->>'late')::boolean,false) then raise exception 'Original invitees cannot become late additions' using errcode='22023'; end if;
 end loop;
 if p_revision>0 and exists(select 1 from public.shepherd_expected_entries e where e.list_id=l.id and not e.late and not exists(select 1 from jsonb_array_elements(p_entries) v where (v->>'person_id')::uuid=e.person_id)) then raise exception 'Published original invitees must be retained' using errcode='22023'; end if;
 -- Clear prior list observations and invalidate any manual resolutions touched by a correction.
 delete from public.shepherd_attendance_resolutions r where r.service_id=p_service_id and r.person_id in(select person_id from public.shepherd_expected_entries where list_id=l.id);
 delete from public.shepherd_attendance_observations where source='expected' and source_id=l.id;
 delete from public.shepherd_expected_entries where list_id=l.id;
 for item in select * from jsonb_array_elements(p_entries) loop
 insert into public.shepherd_expected_entries(organisation_id,list_id,person_id,attendance,late) values(p_organisation_id,l.id,(item->>'person_id')::uuid,item->>'attendance',case when p_revision=0 then false else coalesce((item->>'late')::boolean,true) end);
 insert into public.shepherd_attendance_observations(organisation_id,service_id,person_id,source,source_id,status,actor_id) values(p_organisation_id,p_service_id,(item->>'person_id')::uuid,'expected',l.id,item->>'attendance',auth.uid());
 end loop;
 update public.shepherd_expected_lists set note=btrim(p_note),state=case when p_results then 'results' else 'published' end,revision=case when p_revision=0 then 1 else revision+1 end where id=l.id;
 insert into public.shepherd_audit_events(organisation_id,actor_id,action,revision,details) values(p_organisation_id,auth.uid(),'expected_saved',p_revision+1,jsonb_build_object('list_id',l.id,'reason',p_reason,'results',p_results));
 insert into shepherd_private.requests values(p_organisation_id,auth.uid(),p_request_id,'expected',payload,jsonb_build_object('id',l.id));
 return l.id;
end $$;

create function public.shepherd_admin_action(p_organisation_id uuid,p_action text,p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare prev shepherd_private.requests; p public.shepherd_people; other public.shepherd_people; item jsonb; uid uuid; sid uuid; pid uuid; result jsonb:='{}'; reason text; count_rows integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text,0));
 if not shepherd_private.has_access(p_organisation_id,null,true) then raise exception 'Active administrator with MFA required' using errcode='42501'; end if;
 if p_request_id is null or p_action is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid request' using errcode='22023'; end if;
 select * into prev from shepherd_private.requests where organisation_id=p_organisation_id and actor_id=auth.uid() and request_id=p_request_id;
 if found then if prev.action<>p_action or prev.payload<>p_payload then raise exception 'Retry changed' using errcode='22023'; end if; return prev.result; end if;
 reason:=btrim(coalesce(p_payload->>'reason',''));
 if p_action='create_service' then
 insert into public.shepherd_services(organisation_id,service_date,title) values(p_organisation_id,(p_payload->>'date')::date,btrim(p_payload->>'title')) returning id into sid;
 result:=jsonb_build_object('id',sid);
 elsif p_action='set_member' then
 uid:=(p_payload->>'user_id')::uuid;
 if uid=auth.uid() then raise exception 'Use another administrator to change your own access' using errcode='22023'; end if;
 if length(reason)<3 or not exists(select 1 from public.shepherd_memberships where organisation_id=p_organisation_id and user_id=uid) then raise exception 'Member and reason required' using errcode='22023'; end if;
 update public.shepherd_memberships set role=p_payload->>'role',active=(p_payload->>'active')::boolean where organisation_id=p_organisation_id and user_id=uid;
 elsif p_action in ('update_person','assign_person','set_recovery_caller','merge_people') then
 select * into p from public.shepherd_people where id=(p_payload->>'person_id')::uuid and organisation_id=p_organisation_id and merged_into is null for update;
 if p.id is null then raise exception 'Person unavailable' using errcode='42501'; end if;
 if (p_payload->>'revision')::integer is distinct from p.revision then raise exception 'Person changed. Reload.' using errcode='40001'; end if;
 if length(reason)<3 then raise exception 'A reason is required' using errcode='22023'; end if;
 pid:=p.id;
 if p_action='update_person' then
 update public.shepherd_people set full_name=btrim(p_payload->>'full_name'),phone_e164=nullif(btrim(p_payload->>'phone_e164'),''),revision=revision+1 where id=p.id;
 elsif p_action='assign_person' then
 uid:=(p_payload->>'owner_id')::uuid;
 if not exists(select 1 from public.shepherd_memberships where organisation_id=p_organisation_id and user_id=uid and active) then raise exception 'Active owner required' using errcode='22023'; end if;
 update public.shepherd_people set owner_user_id=uid,revision=revision+1 where id=p.id;
 elsif p_action='set_recovery_caller' then
 uid:=(p_payload->>'caller_id')::uuid; sid:=(p_payload->>'service_id')::uuid;
 if not exists(select 1 from public.shepherd_memberships where organisation_id=p_organisation_id and user_id=uid and active) then raise exception 'Active caller required' using errcode='22023'; end if;
 insert into public.shepherd_recovery_assignments values(p_organisation_id,sid,p.id,uid) on conflict(service_id,person_id) do update set caller_id=excluded.caller_id;
 update public.shepherd_people set revision=revision+1 where id=p.id;
 else
 select * into other from public.shepherd_people where id=(p_payload->>'duplicate_id')::uuid and organisation_id=p_organisation_id and merged_into is null and id<>p.id for update;
 if other.id is null then raise exception 'Duplicate unavailable' using errcode='42501'; end if;
 if (p_payload->>'duplicate_revision')::integer is distinct from other.revision then raise exception 'Duplicate changed. Reload.' using errcode='40001'; end if;
 -- Keep source observations even when both people appeared on one list: conflicts remain visible.
 update public.shepherd_attendance_observations set source_id=id where person_id=other.id and exists(select 1 from public.shepherd_attendance_observations o where o.person_id=p.id and o.source=shepherd_attendance_observations.source and o.source_id=shepherd_attendance_observations.source_id);
 update public.shepherd_attendance_observations set person_id=p.id where person_id=other.id;
 delete from public.shepherd_attendance_resolutions where person_id in(p.id,other.id);
 delete from public.shepherd_expected_entries e where person_id=other.id and exists(select 1 from public.shepherd_expected_entries x where x.list_id=e.list_id and x.person_id=p.id);
 update public.shepherd_expected_entries set person_id=p.id where person_id=other.id;
 delete from public.shepherd_recovery_assignments where person_id=other.id;
 update public.shepherd_contact_attempts set person_id=p.id where person_id=other.id;
 update public.shepherd_people set merged_into=p.id,revision=revision+1 where id=other.id;
 update public.shepherd_people set outcome=case when outcome='Do not contact' or other.outcome='Do not contact' then 'Do not contact' else outcome end,
 callback_on=case when outcome='Do not contact' or other.outcome='Do not contact' then null else callback_on end,revision=revision+1 where id=p.id;
 end if;
 elsif p_action='import_people' then
 if jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows') not between 1 and 500 then raise exception 'Import 1 to 500 rows' using errcode='22023'; end if;
 for item in select * from jsonb_array_elements(p_payload->'rows') loop
 uid:=(item->>'owner_id')::uuid;
 if not exists(select 1 from public.shepherd_memberships where organisation_id=p_organisation_id and user_id=uid and active) then raise exception 'Active owner required' using errcode='22023'; end if;
 if nullif(btrim(item->>'phone_e164'),'') is not null and exists(select 1 from public.shepherd_people where organisation_id=p_organisation_id and phone_e164=btrim(item->>'phone_e164') and merged_into is null) then raise exception 'An imported phone already exists. Review duplicates before importing.' using errcode='22023'; end if;
 insert into public.shepherd_people(organisation_id,full_name,phone_e164,owner_user_id) values(p_organisation_id,btrim(item->>'full_name'),nullif(btrim(item->>'phone_e164'),''),uid);
 count_rows:=count_rows+1;
 end loop;
 result:=jsonb_build_object('imported',count_rows);
 elsif p_action in ('record_attendance','resolve_attendance') then
 sid:=(p_payload->>'service_id')::uuid;
 if not exists(select 1 from public.shepherd_services where id=sid and organisation_id=p_organisation_id and service_date<=public.shepherd_today()) then raise exception 'Choose a service on or before today' using errcode='22023'; end if;
 if length(reason)<3 or jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows') not between 1 and 500 then raise exception 'Rows and a reason are required' using errcode='22023'; end if;
 for item in select * from jsonb_array_elements(p_payload->'rows') loop
 pid:=(item->>'person_id')::uuid;
 if not exists(select 1 from public.shepherd_people where id=pid and organisation_id=p_organisation_id and merged_into is null) then raise exception 'Person unavailable' using errcode='42501'; end if;
 if p_action='resolve_attendance' then
 insert into public.shepherd_attendance_resolutions values(p_organisation_id,sid,pid,item->>'status',reason,auth.uid(),now()) on conflict(service_id,person_id) do update set status=excluded.status,reason=excluded.reason,actor_id=excluded.actor_id,updated_at=now();
 else
 delete from public.shepherd_attendance_resolutions where service_id=sid and person_id=pid;
 insert into public.shepherd_attendance_observations(organisation_id,service_id,person_id,source,source_id,status,actor_id) values(p_organisation_id,sid,pid,'register',sid,item->>'status',auth.uid()) on conflict(source,source_id,person_id) do update set status=excluded.status,actor_id=excluded.actor_id,created_at=now();
 end if;
 count_rows:=count_rows+1;
 end loop;
 result:=jsonb_build_object('recorded',count_rows);
 else raise exception 'Unknown action' using errcode='22023'; end if;
 insert into public.shepherd_audit_events(organisation_id,actor_id,person_id,action,revision,details) values(p_organisation_id,auth.uid(),pid,p_action,coalesce(p.revision+1,1),p_payload-'rows');
 insert into shepherd_private.requests values(p_organisation_id,auth.uid(),p_request_id,p_action,p_payload,result);
 return result;
end $$;
-- Explicit grants protect against hosted defaults which include direct anon privileges.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'shepherd_%') or n.nspname='shepherd_private' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 if f.nspname='public' or f.sig::text like '%has_access(%' or f.sig::text like '%person_access(%' then execute format('grant execute on function %s to authenticated',f.sig); end if;
 end loop;
end $$;
