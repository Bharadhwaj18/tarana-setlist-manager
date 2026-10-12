# Setlist Manager

Setlists, chord charts, gigs, finances and planning for bands. Next.js 16
(App Router) on Vercel, with Supabase for Postgres, auth and file storage.
Each band is a workspace; members join through invite links, and row-level
security in Postgres keeps every band's data to its own members.

## Running it locally

```bash
npm ci
cp .env.example .env.local   # then fill in the values
npm run dev
```

Checks (the same ones CI runs on every pull request):

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Environment variables

| Variable | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Every Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: the reminder cron and account deletion |
| `CRON_SECRET` | Authenticates Vercel Cron's call to `/api/cron/send-reminders` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics (optional) |

## Database schema

`supabase/migrations/` holds changes made through migrations. The full
current structure of the live database is snapshotted to
`supabase/schema/public.sql` by the **Schema snapshot** workflow
(Actions tab → Schema snapshot → Run workflow), which pushes a
`schema-snapshot` branch to open a pull request from. Run it after any change
made directly in the Supabase dashboard so git stays the source of truth.

Objects outside the `public` schema (the `auth.users` trigger that creates
profiles, storage bucket policies) aren't in that snapshot yet and still need
to be copied in by hand.
