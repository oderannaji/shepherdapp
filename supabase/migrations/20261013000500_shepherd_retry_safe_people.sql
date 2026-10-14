-- Keep the original RPC compatible; new clients use this retry-safe wrapper.
create function public.shepherd_create_person_once(p_organisation_id uuid,p_full_name text,p_phone_e164 text,p_owner_user_id uuid,p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare prev shepherd_private.requests; payload jsonb; pid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text,0));
 if not shepherd_private.has_access(p_organisation_id,null,true) then raise exception 'Administrator with MFA required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Request ID is required' using errcode='22023'; end if;
 payload:=jsonb_build_object('name',p_full_name,'phone',p_phone_e164,'owner',p_owner_user_id);
 select * into prev from shepherd_private.requests where organisation_id=p_organisation_id and actor_id=auth.uid() and request_id=p_request_id;
 if found then if prev.action<>'create_person' or prev.payload<>payload then raise exception 'Retry changed' using errcode='22023'; end if; return (prev.result->>'id')::uuid; end if;
 pid:=public.shepherd_create_person(p_organisation_id,p_full_name,p_phone_e164,p_owner_user_id);
 insert into shepherd_private.requests values(p_organisation_id,auth.uid(),p_request_id,'create_person',payload,jsonb_build_object('id',pid));
 return pid;
end $$;
revoke all on function public.shepherd_create_person_once(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.shepherd_create_person_once(uuid,text,text,uuid,uuid) to authenticated;
