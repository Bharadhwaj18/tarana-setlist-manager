@AGENTS.md

## Database migrations

- Every migration that creates a table must also grant access to it, in the same file. Supabase stopped
  granting new `public` tables to the API automatically on 2026-10-30, so without a grant every query to the
  table fails with "permission denied", whatever the RLS policies say.
- Normal pattern: `grant select, insert, update, delete on public.<table> to authenticated;` and the same
  `to service_role;`. Leave `anon` without access. Tables that logged-in users may only read (like
  `finance_audit`) get `grant select ... to authenticated`.
- The person running the migration pastes the SQL into the Supabase editor by hand, so the grant lines have to
  be in the SQL given to them.
