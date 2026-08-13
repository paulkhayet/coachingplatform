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

## Deployment

The production app is linked to the Vercel project `soli-coaching-practice`. A push to the `main` branch creates a production deployment; other branches create preview deployments. Vercel stores the Supabase public URL and anon key for production, preview, and development environments.

The `dev`, `build`, and `start` scripts use the native Next.js runtime for Vercel. The existing Sites/Vinext target remains available through `dev:sites`, `build:sites`, and `start:sites`.

## Supabase data integration

1. Create a Supabase project and run the migrations in `supabase/migrations` in filename order.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the project API settings.
3. Create a coach through Supabase Auth with `full_name` in user metadata. The signup trigger creates the profile, personal organization, and owner membership.
4. Sign into the app through Supabase Auth. The data adapter automatically replaces the demo clients, goals, sessions, assignments, resources, and templates with records allowed by row-level security.

To seed a non-production project, also set `SUPABASE_SERVICE_ROLE_KEY`, `SOLI_ALLOW_SEED=true`, and a strong `SOLI_SEED_PASSWORD`, then run:

```bash
npm run supabase:seed
```

The seed command refuses to run without the explicit safety flag and will not duplicate clients in an organization that already has them. Never expose the service-role key to browser code or commit `.env.local`.

## Privacy model

Every shareable record carries one of four visibility levels: Coach only, Coach + Client, Coach + Parent, or Coach + Client + Parent. Logistics permissions such as billing or scheduling do not imply access to coaching notes. Coaches remain the only users who can broaden visibility.
