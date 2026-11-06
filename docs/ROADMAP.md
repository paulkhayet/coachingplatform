# schedulefa.st — Development Roadmap

Version 0.1 · November 5, 2026

How we get from the prototype to a pilot-ready product. It follows the decisions in the [product plan](PRODUCT_PLAN.md) and the [tech stack](TECH_STACK.md). Update the status column as work lands.

## Principles from day one

- **Tenant isolation everywhere.** Every table carries a business ID, and Postgres row-level security enforces access. Hiding things in the interface is never the only check.
- **Exactly once.** Every Stripe, Zoom, Google and DocuSeal notification is recorded by its event ID and processed once, even if it arrives twice.
- **Money and credits are append-only.** Corrections add new events instead of editing old ones. Money is stored in whole cents, credits to two decimal places.
- **Times in UTC plus a time zone.** Sessions keep their local time across daylight-saving changes.
- **Thin, shippable slices.** Each phase ends with something a pilot business could use.

## Before and alongside development (no code)

| Task | Why | Owner | Status |
| --- | --- | --- | --- |
| Interview 15–20 businesses using the prototype; aim for 3 paid-pilot commitments | Validation gate in the competitive analysis (§10) | Founder | Not started |
| Decide the Stripe Connect account type and fund flow (Q-01) | Blocks every payment feature | Founder | Done 2026-11-06: Standard accounts, direct charges (D-055) |
| Create the schedulefa.st Stripe account, turn on Connect and complete the platform profile | Stripe reviews platforms before businesses can connect; needed for phase 2 | Founder | In progress: the former findatime.org account now has schedulefa.st's details; Connect turned on 2026-11-06 (direct payments, Stripe-hosted onboarding, full Stripe Dashboard, Connect Platform Agreement accepted) with schedulefa.st icon and colors. Left: verify an identity document, then "Confirm final details" so Stripe can review the platform for live accounts. Test mode works now |
| Start Google OAuth app verification for calendar access | Takes weeks; needed for phase 2 | Founder | Not started |
| Register the Zoom app | Marketplace review takes time; needed for phase 2 | Founder | Not started |
| Legal review: e-signing for minors, COPPA and state student-privacy law, recording and AI-summary consent (Q-02) | Required before real families use it | Founder + lawyer | Not started |
| Twilio A2P 10DLC registration | Only when SMS is turned on (optional, D-047) | Founder | Later |
| Send Supabase Auth email through Resend (custom SMTP) in prod | Supabase's built-in email only reaches organization members, a few per hour | Founder | Done 2026-11-06: schedulefa.st verified in Resend (DKIM, SPF, DMARC at the .st registry); prod sends from no-reply@schedulefa.st via Resend's Supabase integration |
| Show schedulefa.st on Google's sign-in screen | Google app published (In production), schedulefa.st verified in Search Console (keep the TXT record), branding verified with /privacy and /terms. The Supabase custom domain add-on stays optional | Founder | Done 2026-11-05 |
| Legal review of the privacy policy and terms at /privacy and /terms | Plain-language versions went live for Google brand verification; part of Q-02 | Founder + lawyer | Before real families use it |
| Redirect `schedulefa.st` to `www.schedulefa.st` in Vercel → Domains | The bare domain did not load when tested on 2026-11-05 | Founder | Done 2026-11-06: the redirect was already set in Vercel; DNS caught up |

## Phases

| # | Phase | Delivers | Depends on | Status |
| --- | --- | --- | --- | --- |
| 1 | **Foundation** | Next.js app in `app/` on Vercel; Supabase dev and prod projects; Drizzle migrations; businesses, staff memberships and row-level security; Supabase Auth sign-in; "create your business" onboarding; shadcn UI brought over from the prototype; CI (typecheck, unit tests, build) | — | Done — live at www.schedulefa.st (2026-11-05) |
| 2 | **Booking pages** (first usable slice) | Coach availability; Google Calendar connection (busy times in, bookings out); booking pages with questionnaires; public booking flow; double-booking prevented by a Postgres constraint; Stripe Connect checkout and refunds for paid calls; Zoom links; Resend confirmations and reminders via pg_cron; guest reschedule and cancel page | 1, Stripe platform account, Google verification, Zoom app | Not started |
| 3 | **Clients and credits** | Students, guardians and their separate permissions; offerings and session types; purchases; the append-only credit ledger and funding rules (ported from the prototype's `credits.ts`, `booking.ts`, `permissions.ts` with tests first) | 1 | Not started |
| 4 | **Enrollment** | Inquiries and the guided intake workflow; offers and versions; DocuSeal embedded signing; Stripe installments funding credits; portal invitations; parent and student portals | 2, 3, legal review | Not started |
| 5 | **Coaching** | Sessions, attendance, cancellations and makeups; Zoom summary import; private notes; OpenAI follow-up drafts with recipient permission checks; homework and files | 3, 4 | Not started |
| 6 | **Pilot readiness** | Teams, coach pools and access grants; staff seats and Stripe Billing; issue queue; audit log; data export; error monitoring; daylight-saving and load tests | 1–5 | Not started |

## Phase 1 checklist

- [x] Next.js + TypeScript app scaffolded in `app/`, with the brand theme and shadcn components from the prototype
- [x] Database schema for businesses, profiles and memberships, managed by Drizzle
- [x] Row-level security policies and helper functions in SQL migrations, with 9 database tests
- [x] Supabase Auth: sign up, sign in, sign out, email confirmation callback
- [x] Onboarding: create a business and become its owner (one transaction)
- [x] Signed-in app shell with the business's workspace and team list
- [x] Unit tests (Vitest) and GitHub Actions CI
- [x] Create the Supabase dev project and add its keys to `app/.env.local` (founder)
- [x] Create the Supabase prod project, apply the migrations and add its keys (founder)
- [x] Run the migrations against the dev project (`npm run db:migrate`) and sign up end to end (sign up, confirm, create a business, Team page)
- [x] Fix the Supabase advisor findings (`0002_advisor_fixes`: RLS helpers moved to the `private` schema, index on `businesses.created_by`)
- [x] Sign in with Google, and with an emailed sign-in link for existing accounts (D-053)
- [x] Turn on Google sign-in: create a Google Cloud OAuth client (Web application, redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`), then paste its client ID and secret into Supabase → Authentication → Sign In / Providers → Google (founder; dev and prod)
- [x] Make email links work in any browser, in Supabase → Authentication → Emails → Templates (founder; dev and prod). The default links fail with the "link" error if opened in a different browser than the one used to sign up:
  - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
  - Magic Link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- [x] Connect the repository to Vercel (root directory `app`), add the environment variables and the www.schedulefa.st domain (founder)
- [x] Sign up end to end on the live site with Google (sign in, create a business, Team page)

## Changing this roadmap

Reordering phases or changing scope is a product decision: record it in the [decision log](PRODUCT_PLAN.md) and update this file.
