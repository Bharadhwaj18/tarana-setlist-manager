# Restoring Tarana Setlist Manager

This repo is written by the `Backup Supabase` workflow in
[tarana-setlist-manager](https://github.com/Bharadhwaj18/tarana-setlist-manager/blob/main/.github/workflows/backup.yml)
every 15 minutes and on every database change pushed to main. Each commit is a full, restorable
snapshot; to go back in time, check out an older commit first.

| Path | What it is |
| --- | --- |
| `db/schema.sql` | Every table, constraint, index, function, trigger, RLS policy and grant in `public` |
| `db/data.sql` | Every row in `public`, `auth` (user accounts) and `storage` (buckets, file records) |
| `db/extras.sql` | Our policies and triggers on Supabase-managed tables (file access rules, sign-up trigger) |
| `db/server_version.txt` | Postgres version the backup came from |
| `storage/<bucket>/…` | Every Storage file. `storage/manifest.json` lists them and any skipped as over 95 MB |

Not included on purpose: live login sessions and refresh tokens. After a restore everyone signs in
again with the same email and password.

## Restore into a new Supabase project

Use a new, empty project: the steps below assume nothing is in it yet. Never run them against the live
project.

1. Create the project in the same region, on the Postgres major version in `db/server_version.txt`.
2. Copy its connection string (Project Settings → Database → Connection string, **Session** mode) into
   `NEW_DB_URL`. Use a `psql` at least as new as that server.
3. Restore the database in one transaction: structure, then rows with triggers and foreign-key checks
   paused while they load, then the extras.

   ```bash
   psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
     -f db/schema.sql \
     -c 'SET session_replication_role = replica' \
     -f db/data.sql \
     -c 'SET session_replication_role = DEFAULT' \
     -f db/extras.sql
   ```

4. Upload the files. With the new project's URL and service-role key:

   ```bash
   cd storage
   for f in $(find . -type f ! -name manifest.json | sed 's|^\./||'); do
     bucket="${f%%/*}"; path="${f#*/}"
     curl -sf -X POST "$NEW_SUPABASE_URL/storage/v1/object/$bucket/$path" \
       -H "Authorization: Bearer $NEW_SERVICE_ROLE_KEY" -H "x-upsert: true" \
       --data-binary @"$f" > /dev/null || echo "FAILED: $f"
   done
   ```

   The buckets themselves came back with `db/data.sql`. The file records in `storage.objects` also
   came back; uploading with `x-upsert` puts the real bytes behind them.

5. Point the app at the new project: update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   and `SUPABASE_SERVICE_ROLE_KEY` in Vercel, then the `SUPABASE_DB_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` secrets in GitHub so backups follow it.
6. In the new project's Auth settings, copy over the Site URL, redirect URLs, email templates and any
   sign-in providers. Those live in the Supabase dashboard, not the database.

## Getting back a single row or file

Everything is plain text, so `git log -p -- db/data.sql` or `git log -- storage/<bucket>/<path>` shows
when something changed. Copy the old row or file out of that commit and put it back by hand.
