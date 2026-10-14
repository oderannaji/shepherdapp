-- Prevent an old administrator screen from overwriting newer account restrictions.
alter table public.shepherd_memberships add column revision integer not null default 1;
create or replace function public.shepherd_members(p_organisation_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not shepherd_private.has_access(p_organisation_id,null,true) then raise exception 'Administrator access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',m.display_name,'role',m.role,'active',m.active,'revision',m.revision,'email',u.email,'confirmed',u.email_confirmed_at is not null) order by m.display_name)
 from public.shepherd_memberships m join auth.users u on u.id=m.user_id where m.organisation_id=p_organisation_id),'[]');
end $$;
create or replace function public.shepherd_grant_member(p_organisation_id uuid,p_user_id uuid,p_email text,p_name text,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text,0));
 if not shepherd_private.has_access(p_organisation_id,null,true) then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_role is null or p_role not in ('admin','volunteer') or length(btrim(p_name)) not between 1 and 140 or not exists(select 1 from auth.users where id=p_user_id and lower(email)=lower(btrim(p_email))) then raise exception 'Invalid account details' using errcode='22023'; end if;
 -- Reinviting must never silently reactivate an account or alter its role.
 if exists(select 1 from public.shepherd_memberships where organisation_id=p_organisation_id and user_id=p_user_id) then return; end if;
 insert into public.shepherd_memberships(organisation_id,user_id,display_name,role,active) values(p_organisation_id,p_user_id,btrim(p_name),p_role,true);
 insert into public.shepherd_audit_events(organisation_id,actor_id,action,revision,details) values(p_organisation_id,auth.uid(),'member_invited',1,jsonb_build_object('user_id',p_user_id,'role',p_role));
end $$;
create or replace function public.shepherd_admin_action(p_organisation_id uuid,p_action text,p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if not exists(select 1 from public.shepherd_memberships where organisation_id=p_organisation_id and user_id=uid and revision=(p_payload->>'revision')::integer) then raise exception 'Account access changed. Reload before saving.' using errcode='40001'; end if;
 update public.shepherd_memberships set role=p_payload->>'role',active=(p_payload->>'active')::boolean,revision=revision+1 where organisation_id=p_organisation_id and user_id=uid;
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
 update public.shepherd_expected_lists set revision=revision+1 where id in(select list_id from public.shepherd_expected_entries where person_id in(p.id,other.id));
 update public.shepherd_expected_entries e set late=e.late and x.late from public.shepherd_expected_entries x where e.list_id=x.list_id and e.person_id=p.id and x.person_id=other.id;
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
 if item->>'version' is distinct from shepherd_private.attendance_version(sid,pid) then raise exception 'Attendance changed. Reload before saving.' using errcode='40001'; end if;
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
