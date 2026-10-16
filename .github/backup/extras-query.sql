-- Prints the SQL that recreates what a public-schema dump leaves out: our own policies on Supabase's
-- storage tables, and our own triggers on auth/storage tables (e.g. creating a profile on sign-up).
-- The backup workflow runs this with psql -At and saves the output as db/extras.sql.

-- With an empty search_path, policy expressions and trigger definitions print fully schema-qualified,
-- so the output works in the restore session (schema.sql leaves search_path empty too).
set search_path = '';

select '-- Our policies and triggers on Supabase-managed tables. Run after schema.sql and data.sql.';

select format(
  'drop policy if exists %I on %I.%I;' || chr(10) || 'create policy %I on %I.%I as %s for %s to %s%s%s;',
  policyname, schemaname, tablename,
  policyname, schemaname, tablename, lower(permissive), lower(cmd), array_to_string(roles, ', '),
  coalesce(' using (' || qual || ')', ''),
  coalesce(' with check (' || with_check || ')', '')
)
from pg_policies
where schemaname in ('storage', 'auth')
order by schemaname, tablename, policyname;

select format('drop trigger if exists %I on %I.%I;', t.tgname, n.nspname, c.relname) || chr(10) || pg_get_triggerdef(t.oid) || ';'
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where not t.tgisinternal
  and n.nspname in ('auth', 'storage')
  and pn.nspname = 'public'
order by n.nspname, c.relname, t.tgname;
