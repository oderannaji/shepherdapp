-- Lock list denominators, reject future attendance and protect concurrent register edits.
create function shepherd_private.attendance_version(service uuid,person uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(coalesce((select jsonb_agg(to_jsonb(o) order by o.id)::text from public.shepherd_attendance_observations o where o.service_id=service and o.person_id=person),'[]') || coalesce((select to_jsonb(r)::text from public.shepherd_attendance_resolutions r where r.service_id=service and r.person_id=person),'{}'));
$$;
revoke all on function shepherd_private.attendance_version(uuid,uuid) from public,anon,authenticated;
create function public.shepherd_add_guest(p_organisation_id uuid,p_full_name text,p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare prev shepherd_private.requests; payload jsonb; pid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text,0));
 if not shepherd_private.has_access(p_organisation_id) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if p_request_id is null or p_full_name is null or length(btrim(p_full_name)) not between 1 and 140 then raise exception 'A guest name is required' using errcode='22023'; end if;
 payload:=jsonb_build_object('name',btrim(p_full_name));
 select * into prev from shepherd_private.requests where organisation_id=p_organisation_id and actor_id=auth.uid() and request_id=p_request_id;
 if found then if prev.action<>'guest' or prev.payload<>payload then raise exception 'Retry changed' using errcode='22023'; end if; return (prev.result->>'id')::uuid; end if;
 insert into public.shepherd_people(organisation_id,full_name,owner_user_id) values(p_organisation_id,btrim(p_full_name),auth.uid()) returning id into pid;
 insert into public.shepherd_audit_events(organisation_id,actor_id,person_id,action,revision) values(p_organisation_id,auth.uid(),pid,'guest_created',1);
 insert into shepherd_private.requests values(p_organisation_id,auth.uid(),p_request_id,'guest',payload,jsonb_build_object('id',pid));
 return pid;
end $$;
revoke all on function public.shepherd_add_guest(uuid,text,uuid) from public,anon;
grant execute on function public.shepherd_add_guest(uuid,text,uuid) to authenticated;

create or replace function public.shepherd_save_expected(p_organisation_id uuid,p_service_id uuid,p_list_id uuid,p_revision integer,p_request_id uuid,p_note text,p_entries jsonb,p_results boolean,p_reason text default '') returns uuid language plpgsql security definer set search_path='' as $$
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
 if exists(select 1 from public.shepherd_services where id=p_service_id and service_date>public.shepherd_today()) and (p_results or exists(select 1 from jsonb_array_elements(p_entries) e where e->>'attendance'<>'unknown')) then raise exception 'Attendance can only be recorded on or after the service date' using errcode='22023'; end if;
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
 if p_revision>0 and ((exists(select 1 from public.shepherd_expected_entries where list_id=l.id and person_id=person and late) and not coalesce((item->>'late')::boolean,false)) or (not exists(select 1 from public.shepherd_expected_entries where list_id=l.id and person_id=person) and not coalesce((item->>'late')::boolean,false))) then raise exception 'New people on a published list are late additions' using errcode='22023'; end if;
 end loop;
 if p_revision>0 and exists(select 1 from public.shepherd_expected_entries e where e.list_id=l.id and not e.late and not exists(select 1 from jsonb_array_elements(p_entries) v where (v->>'person_id')::uuid=e.person_id)) then raise exception 'Published original invitees must be retained' using errcode='22023'; end if;
 -- Clear prior list observations and invalidate any manual resolutions touched by a correction.
 delete from public.shepherd_attendance_resolutions r where r.service_id=p_service_id and r.person_id in(select person_id from public.shepherd_expected_entries where list_id=l.id union select (e->>'person_id')::uuid from jsonb_array_elements(p_entries) e);
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
create or replace function public.shepherd_attendance(p_organisation_id uuid,p_service_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not shepherd_private.has_access(p_organisation_id) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.shepherd_services where id=p_service_id and organisation_id=p_organisation_id) then raise exception 'Service unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('person_id',a.person_id,'version',shepherd_private.attendance_version(p_service_id,a.person_id),'full_name',p.full_name,'status',a.status,'conflict',a.conflict,'observations',case when shepherd_private.has_access(p_organisation_id,null,true) then a.observations else '[]'::jsonb end))
 from shepherd_private.attendance(p_organisation_id,p_service_id) a join public.shepherd_people p on p.id=a.person_id where shepherd_private.person_access(p.id)),'[]');
end $$;
