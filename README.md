# Rigly

The app my band runs on. Rehearsals, setlists, chord charts, gigs and money - one PWA the whole band uses on stage and off.

**Live:** https://tarana-setlist-manager.vercel.app

## What it does

- **Setlists** - drag-and-drop set building with sections, shareable and printable (PDF export)
- **Chord charts** - charts with live transposition (chordsheetjs)
- **Shows** - enquiry-to-booking pipeline with status tracking and documents
- **Finance** - gig income, expenses, splits between members, budgets, reports
- **Calendar** - rehearsals, gigs, availability, push notifications (web-push)
- **Offline-first PWA** - service worker, offline sync, installable on band members' phones

## Stack

Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres with row-level security on every table), Tailwind CSS 4, Radix UI, zod, Vitest. Product analytics via PostHog. Nightly automated database backups via GitHub Actions.

## Why it looks like this

A band is a small business with terrible tooling. Everything here exists because a spreadsheet or a WhatsApp group failed us first. The finance split wizard alone has saved more arguments than any other feature I've built.
