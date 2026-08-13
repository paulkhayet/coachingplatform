# Soli

Soli is a calm practice workspace for life coaches. This MVP focuses on the daily dashboard, a client-centered record, minor/guardian privacy, scheduling, resources, templates, and a focused session-note experience.

## Included in this foundation

- Responsive coach workspace with realistic adult and teen client data
- Central client hub for goals, sessions, notes, assignments, files, people, and billing
- First-class guardian and third-party relationships with explicit visibility labels
- Session workspace for coach-written notes and optional meeting-summary transcription only
- Calendar, reusable resources, programs/templates, command search, and quick-add flows
- Organization-aware Postgres schema with row-level security boundaries
- Stripe, Google Calendar/Meet, Zoom, messaging, secure storage, and Supabase environment seams

The UI is an interactive product prototype. External services remain intentionally disconnected until their credentials and callback URLs are configured.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when connecting external services. Apply the SQL in `supabase/migrations` to a new Supabase project before replacing the seed-data adapter.

## Privacy model

Every shareable record carries one of four visibility levels: Coach only, Coach + Client, Coach + Parent, or Coach + Client + Parent. Logistics permissions such as billing or scheduling do not imply access to coaching notes. Coaches remain the only users who can broaden visibility.
