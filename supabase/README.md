# Database changes

The live Supabase project is the source of truth for the schema. This folder makes changes reviewable.

- `migrations/` — every change from now on, one numbered file each (`YYYYMMDDHHMMSS_name.sql`). Files are idempotent and run in the SQL editor in order. Keep each file small.
- `history/` — the scripts that built the workspace model, recorded for reference. They are not a replayable baseline (the original tables were created before migrations were kept).

To capture a real baseline, install the Supabase CLI and run `supabase db pull`, then commit the result as `migrations/00000000000000_baseline.sql`. After that, a fresh project can be rebuilt from this folder.
