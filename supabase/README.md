# Database changes

Every change to the database is a file in `supabase/migrations/`, applied with the Supabase CLI.
The CLI runs each file whole, inside a transaction, and records it in the database
(`supabase_migrations.schema_migrations`). So a file is either fully applied or not at all, and
`migration list` always shows what the live database has.

Don't paste migrations into the dashboard SQL editor any more. If any text is highlighted, the
editor runs only that part, and nothing records what ran.

## One-time setup (per computer)

```bash
npx supabase login
npx supabase link --project-ref qdoonmneblwmkxnbxqxq
```

`link` asks for the database password (Supabase dashboard → Project Settings → Database).

The migrations up to `20261024000000` were applied by hand before the CLI tracked anything. Record
them as applied, once, ever:

```bash
npx supabase migration repair --status applied 20261002000000 20261002000100 20261013000000 20261014000000 20261014000100 20261015000000 20261015000200 20261016000000 20261017000000 20261018000000 20261019000000 20261020000000 20261021000000 20261022000000 20261023000000 20261024000000
```

(`20261015000200_one_setlist_per_show` never ran by hand; `20261023000000_data_integrity` created
the same index, so it counts as applied.)

## Making a change

```bash
npx supabase migration new short_name      # creates supabase/migrations/<timestamp>_short_name.sql
# write the SQL in that file
npx supabase migration list                # Local vs Remote: what is waiting to be applied
npx supabase db push                       # shows what it will apply and asks before running
```

Then commit the migration together with any app code that needs it, and push. Vercel deploys on push,
so apply the migration first if the new code depends on it.

Every push to `main` that touches `supabase/migrations/` also starts a full backup
(`.github/workflows/backup.yml`).
