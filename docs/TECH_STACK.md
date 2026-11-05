# schedulefa.st — Tech Stack

Version 0.1 · November 5, 2026

Goal: use as few separate services as possible. Supabase and Vercel cover everything they reasonably can, and a separate service is added only where neither can do the job.

Every choice below is confirmed and recorded in the [product plan](PRODUCT_PLAN.md) decision log (D-038–D-042, D-050–D-052). The plan's section 15 holds the summary; this file adds the reasoning.

## Core platform

| Layer | Choice | Status | Notes |
| --- | --- | --- | --- |
| Hosting | **Vercel** | Confirmed — D-050 | Runs the Next.js app, public booking pages, and the endpoints that receive notifications from Stripe, Zoom, Google and DocuSeal. Vercel Cron can trigger jobs. |
| Database | **Supabase Postgres** | Confirmed — D-050 | One database for every business. Row-level security keeps each business's data separate. Postgres rules prevent double-booking a coach, and transactions keep credits and payments consistent. |
| Logins | **Supabase Auth** | Confirmed — D-050 | Staff, separate parent and student logins, and email sign-in links. Guest booking and offer links use expiring tokens stored in the database. |
| File storage | **Supabase Storage** | Confirmed — D-050 | Homework, resources, and a copy of every signed agreement and its audit trail. |
| Background jobs | **Supabase pg_cron + Supabase Queues** | Confirmed — D-050 | Reminders, unpaid-reservation cutoffs, Zoom summary imports, and retrying incoming notifications. Tables of processed event IDs make sure nothing is charged, credited or sent twice. |
| App framework | **Next.js + React + TypeScript** | Confirmed — D-052 | One codebase for the staff app, family portal and public pages. |
| UI | **Tailwind CSS + shadcn/ui** | Confirmed — D-052 | Already used in the prototype, so its screens carry over. |
| Database access | **Drizzle ORM** + Supabase client | Confirmed — D-052 | Drizzle for typed queries and migrations; the Supabase client for auth and storage. |
| Monitoring | Vercel and Supabase dashboards | Confirmed — D-052 | Add an error tracker such as Sentry later only if needed. |

## External services

| Need | Choice | Status | Notes |
| --- | --- | --- | --- |
| Coaching payments | **Stripe Connect** | Confirmed — D-041 | Families pay each business directly. There is no schedulefa.st fee (D-042). The Connect account and fund-flow model is still open (Q-01). |
| schedulefa.st subscriptions | **Stripe Billing** | Confirmed — D-052 | Same Stripe account as Connect, so no extra service. |
| E-signatures | **DocuSeal Cloud** (hosted) | Confirmed — D-051, D-052 | Embedded React signing inside the guest offer flow, templates, multiple signers, audit trail, and notifications back to the app when a document is signed. Hosted, because self-hosting would need a host other than Vercel. Keep your own copy of each signed PDF in Supabase Storage. |
| Email | **Resend** | Confirmed — D-052 | Transactional email for the app, and Supabase Auth's production email (Supabase's built-in email is for development only). |
| SMS reminders | **Twilio** | Confirmed — D-052 | Optional (D-047), so it can wait until after launch. US numbers require A2P 10DLC registration. |
| AI follow-up drafts | **OpenAI API** | Confirmed — D-052 | Audience-specific drafts from a permitted session source (D-034–D-036). The model, data-retention terms, quality tests and usage limits are still to be chosen. |
| Calendar | **Google Calendar API** | Confirmed — D-039 | Coaches connect their own accounts. Google's app verification for calendar access takes time, so start it early. |
| Video | **Zoom API** | Confirmed — D-038 | Meeting links and meeting summaries. Zoom reviews marketplace apps before listing them. |

## Service count

Accounts you set up and pay for:
1. Vercel
2. Supabase
3. Stripe
4. DocuSeal
5. Resend
6. OpenAI
7. Twilio (can wait until SMS is turned on)

Google and Zoom each need a registered developer app, but coaches connect their own accounts.

## Still open

- Stripe Connect account type and fund flow (Q-01).
- OpenAI model choice, processing and data-retention terms, quality tests with representative coaching examples, usage limits and costs.
- Legal review of signing requirements for agreements involving minors (Q-02).
- Privacy review for minors' data (COPPA, state student-privacy laws) and consent for session recording and AI summaries.
- Lead times: Google's app verification for calendar access, Zoom marketplace review, and US SMS (A2P 10DLC) registration.

## Build order

See the [development roadmap](ROADMAP.md) for the phases and their status.

## Moving from the prototype

The prototype in [`platform/`](../platform) already uses React, TypeScript, Tailwind and shadcn/ui. Its business rules move from the browser to the server: credit funding, booking checks, permissions, cancellations and follow-up delivery (`src/lib/`). The new work is the Supabase schema and row-level security rules, logins, background jobs, and the real integrations.
