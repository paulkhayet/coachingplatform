# schedulefa.st — app

The production application. Phase 1 (foundation) of the [development roadmap](../docs/ROADMAP.md).

Next.js 16 + React 19 + TypeScript, Tailwind CSS 4 + shadcn/ui, Supabase (Postgres, Auth), Drizzle ORM. Deployed on Vercel.

## What works today

- Sign up with email and password, email confirmation, sign in, sign out
- Create a business and become its owner, with a booking link and time zone
- A signed-in workspace (Today, Team) for that business
- Row-level security on every table: people only see businesses they're active members of; only owners manage the team; nobody can grant themselves ownership

## Set up locally

1. Create a Supabase project (use a separate one for development and production).
2. `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project settings → API keys)
   - `DATABASE_URL` (Project settings → Database → connection string; direct or session pooler)
3. Install and migrate:
   ```sh
   npm install
   npm run db:migrate
   ```
4. In Supabase → Authentication → URL configuration, set the Site URL to `http://localhost:3100` and add `http://localhost:3100/auth/confirm` to the redirect URLs (add your Vercel URLs too).
5. `npm run dev` → http://localhost:3100

Without the Supabase keys the app still runs and shows setup instructions.

## Database changes

The schema lives in `src/db/schema.ts`. Security rules, functions and triggers are hand-written SQL migrations.

```sh
npm run db:generate                          # table changes → new SQL migration in drizzle/
npx drizzle-kit generate --custom --name=x   # empty migration for policies/functions
npm run db:migrate                           # apply to DATABASE_URL
```

Every new business-owned table needs a `business_id` column, `ENABLE ROW LEVEL SECURITY`, policies, and tests in `tests/db/`.

Helper functions that policies call (`is_member`, `has_role`) live in the `private` schema, which the Supabase API doesn't expose. Only functions the app calls as RPCs (like `create_business`) belong in `public`.

## Tests

```sh
npm run typecheck
npx vitest run --project unit      # pure logic
TEST_DATABASE_URL=postgres://… npx vitest run --project db   # row-level security, against a throwaway Postgres
```

The database tests wipe the target database and load a small stand-in for Supabase's `auth` schema (`tests/db/supabase-stub.sql`). Never point `TEST_DATABASE_URL` at a real project. CI runs everything, including the database tests against Postgres 15, on every push.

## Deploy on Vercel

Import the GitHub repository, set **Root Directory** to `app`, and add the environment variables from `.env.example` (with `NEXT_PUBLIC_SITE_URL` set to the deployed URL).
