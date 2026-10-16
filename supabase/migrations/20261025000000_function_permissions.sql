-- Function permissions. Safe to re-run.
--
-- Postgres lets everyone (PUBLIC, so also logged-out visitors via /rest/v1/rpc) run a new function
-- unless told otherwise, and 15 of ours were still open that way. Most check auth.uid() and refuse
-- anyway, but nothing a logged-out visitor can reach should depend on that.
--
--   * Logged-out visitors (anon) can run only invite_preview and invite_sections — the /invite/<token>
--     page is public, so someone who hasn't signed up yet can see what they're joining.
--   * Signed-in users and the service role keep EXECUTE on everything: RLS policies call the helper
--     functions as the signed-in user, and trigger functions stay granted so no trigger can be
--     affected. (Trigger and event-trigger functions can't be called directly over the API anyway.)
--   * Functions created from now on start out closed to anon and PUBLIC.

begin;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

grant execute on function public.invite_preview(text) to anon;
grant execute on function public.invite_sections(text) to anon;

-- Sign-up runs this trigger as Supabase's auth role; keep it explicitly allowed.
grant execute on function public.handle_new_user() to supabase_auth_admin;

alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

commit;
