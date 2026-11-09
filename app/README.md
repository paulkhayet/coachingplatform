# schedulefa.st — app

The production application. Phase 1 (foundation) of the [development roadmap](../docs/ROADMAP.md).

Next.js 16 + React 19 + TypeScript, Tailwind CSS 4 + shadcn/ui, Supabase (Postgres, Auth), Drizzle ORM. Deployed on Vercel.

## What works today

- Sign up with email and password, email confirmation, sign in, sign out
- Continue with Google, and emailed sign-in links for existing accounts (Google must be turned on in Supabase → Authentication → Sign In / Providers)
- Create a business and become its owner, with a booking link and time zone
- A signed-in workspace (Today, Team) for that business
- Owners invite coaches and administrators by email (Team → Invite someone). The link at `/join/<token>` works once, for 14 days, and only for an account with the invited email; one account can work for several businesses
- Booking pages are hosted by one coach, or shared by a group (owners and administrators choose): guests see every time someone in the group is free, and each call goes to the free coach with the fewest recent calls from that page
- Row-level security on every table: people only see businesses they're active members of; only owners manage the team; nobody can grant themselves ownership
- Payments (phase 2, in progress): an owner, or an administrator trusted with finances, connects the business's own Stripe account (Connect, full Stripe Dashboard, direct charges; D-055). Stripe events arrive at `/api/stripe/webhook`, are signature-checked, and are recorded once each in `stripe_events`

## Stripe in test mode

1. Add `STRIPE_SECRET_KEY` (a `sk_test_…` key) and `DATABASE_URL` to `.env.local`.
2. Forward Stripe events to your machine with the Stripe CLI:
   ```sh
   stripe login
   stripe listen --forward-to localhost:3100/api/stripe/webhook --forward-connect-to localhost:3100/api/stripe/webhook
   ```
   Then start the app with `npm run dev:stripe`, which reads the CLI's signing secret (`stripe listen --print-secret`) into `STRIPE_WEBHOOK_SECRET` for that run, so it never needs saving. (Or put the printed `whsec_…` in `.env.local` and use `npm run dev`.)
3. Open **Payments** in the app and click **Connect Stripe**. In test mode, Stripe's onboarding accepts its published test values (for example the "Use test data" option where offered).

Only the server writes `stripe_accounts` (through `src/db/server.ts`, which bypasses RLS); owners and administrators can read it.

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

**Production migrates itself.** Vercel runs `npm run vercel-build`, which runs `scripts/migrate.mjs` (pending migrations, using the production `DATABASE_URL`) and then `next build`. If a migration fails, the build fails and the previous deployment stays live. Preview and local builds skip it. So: commit the migration with the code that needs it and push; there is no manual production step. Because a migration runs a minute or so before the new code goes live, prefer additive changes, and remove old columns in a later deploy once nothing uses them.

Helper functions that policies call (`is_member`, `has_role`) live in the `private` schema, which the Supabase API doesn't expose. Only functions the app calls as RPCs (like `create_business`) belong in `public`.

## Tests

```sh
npm run typecheck
npx vitest run --project unit      # pure logic
TEST_DATABASE_URL=postgres://… npx vitest run --project db   # row-level security, against a throwaway Postgres
```

The database tests wipe the target database and load a small stand-in for Supabase's `auth` schema (`tests/db/supabase-stub.sql`). Never point `TEST_DATABASE_URL` at a real project. CI runs everything, including the database tests against Postgres 15, on every push.

## Deploy on Vercel

Import the GitHub repository, set **Root Directory** to `app`, and add the environment variables from `.env.example` (with `NEXT_PUBLIC_SITE_URL` set to the deployed URL). For payments, also add `DATABASE_URL` (transaction pooler), `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, and create a Stripe webhook endpoint for `https://<your domain>/api/stripe/webhook` listening to **events on connected accounts** (at least `account.updated` and `account.application.deauthorized`). Migrations run automatically on each production deploy (see Database changes).
