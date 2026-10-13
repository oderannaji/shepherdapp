-- Hosted Supabase can grant EXECUTE directly to anon through default privileges.
-- Revoking PUBLIC alone does not remove those direct grants.
revoke all on function shepherd_private.has_access(uuid, uuid, boolean) from public, anon;
revoke all on function public.shepherd_today() from public, anon;
revoke all on function public.shepherd_record_follow_up(uuid, integer, uuid, text, date, text) from public, anon;
revoke all on function public.shepherd_create_person(uuid, text, text, uuid) from public, anon;

grant execute on function shepherd_private.has_access(uuid, uuid, boolean) to authenticated;
grant execute on function public.shepherd_today() to authenticated;
grant execute on function public.shepherd_record_follow_up(uuid, integer, uuid, text, date, text) to authenticated;
grant execute on function public.shepherd_create_person(uuid, text, text, uuid) to authenticated;
