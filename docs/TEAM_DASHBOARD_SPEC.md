# Team dashboard: intake, assignments and finances (D-074)

Status: built and verified on dev 2026-11-13 (not yet committed or deployed). Written as a complete brief for one long implementation run.

Where the build differs from this brief:

- A paid call cancelled too late for a refund counts as delivered revenue but pays the coach nothing.
- Free calls, including first calls from Intake, add no revenue and no coach pay.
- A salary stops automatically on the day someone leaves the team (a $0 salary entry from that date).
- Team load and coach suggestions don't read Google Calendar; it is checked when a call is actually booked.
- Enrolling an inquiry and linking its first call can only be done by the server, not through the data API; stage and assignment changes are written to the timeline by a database trigger.
- Booking pages can no longer use the link name `inquire`.
- The session format for per-session pay is matched on a coaching booking's title, which is the package's session format name.

## Goal

Give businesses with a team of coaches one place to run the business:

- **Owners and administrators** run intake (new families coming in), match families to coaches, see coach capacity, and work through a queue of things that need attention.
- **Owners only** see the money: revenue, coach pay, Stripe fees, profit and margin, plus a coach pay report they can export for payroll.
- **Coaches** see the inquiries assigned to them for a first call, and record how it went. Nothing else changes for them.

It's a **Team plan** feature. Free and Solo businesses see an upgrade card in its place.

## Founder decisions (2026-11-12)

| Topic | Decision |
|---|---|
| Coach pay | Chosen per coach: **hourly**, **per session** (with optional per-format overrides), **percentage of revenue**, or **salaried** (fixed monthly). Rates are dated, so a change applies from a date onward and never rewrites past months. |
| Intake | **Public inquiry form per business + pipeline**: New → Matching → First call → Offer → Enrolled / Lost. Assign a staff owner and a proposed coach, book the first call, convert to a client keeping the history. No contracts or online checkout in this slice. |
| Profit | Revenue − **coach pay** − **Stripe fees**. No manual expenses. Refunds already reduce revenue (see definitions). |
| Plan | **Team only.** On a downgrade, data is kept but hidden, and the public form says the business isn't taking inquiries. |
| Who sees what | Finances and coach pay: owner only. Intake, assignments and the attention queue: owner and administrators. Coaches: only inquiries where they're the proposed coach. |

## What exists today (read these first)

- `docs/PRODUCT_PLAN.md`: D-013 (admin matching, coach first call, admin money talk), D-022 (guided intake), D-027 (roles), D-055 (Stripe Connect direct charges), D-072 (plans), D-073 (family portal).
- `app/src/db/schema.ts`:
  - `memberships`: role owner/administrator/coach, `coaches` flag, `title`
  - `coaching_clients` (one `coach_membership_id`), `client_guardians`, `coaching_packages`, `client_packages` (price in `terms` jsonb), `client_credit_periods`
  - `client_credit_payments`: offline payments only; card payments for packages aren't built yet
  - `client_credit_events`: funded/reserved/released/used/forfeited/expired
  - `bookings`:
    - fields: `price_cents`, `payment_status` (paid/refunded/refund_failed), `attended_at`, `credit_cancellation_outcome`, `cancelled_at`, `cancelled_by`, `calendar_sync_error`, `meeting_error`, `unpaid_cancelled`
    - shape check `bookings_coaching_terms`: a booking with no client and no page is allowed if it has a guest email; that's how the first call works
- Credit balances: the RPC used by `lib/family/dashboard.ts` and the client page (available, booked, used, due).
- Free times and slots:
  - `freeTimes`, `availableStarts`, `availableCoachingStarts` in `lib/booking/server.ts`
  - `hoursForBusiness`, `bookableStarts` in `lib/slots.ts`
- Plans: `lib/billing/plans.ts` (`planLimits`, `UPGRADE_MESSAGES`), and the workspace subscription lookup used by the reminder query (`workspace_subscriptions`, `stripeLivemode`).
- Roles and RLS: `private.is_member`, `private.has_role(business_id, ARRAY[...])` and SECURITY DEFINER helpers in the `private` schema. Policies are OR-ed, so read every existing policy on a table before adding one; slice 1 of the family portal found a leak that way.
- Emails: `lib/booking/emails.ts` (pure templates with the brand header) and `lib/email/server.ts` (`sendEmail` with idempotency keys).
- Spam handling to copy: `app/src/app/contact/actions.ts` (stored first, a per-email hourly limit).
- Navigation: `app/src/app/app/nav.tsx`. Settings tabs: `app/src/app/app/settings/`.
- Tests: unit tests next to the code (`*.test.ts`); RLS tests in `app/tests/db/rls.test.ts` against a local Postgres (see "Verification").

## Data model (one migration, `0031_team_dashboard`)

Generate with `npx drizzle-kit generate --name team_dashboard` from `app/`, then append the custom SQL (RLS, functions, triggers) after `--> statement-breakpoint` markers, like `0030_family_access.sql`.

### Coach pay

`coach_pay_rates` stores one row per change, and the latest `effective_from` on or before a date applies:

- `id`, `business_id`, `membership_id` (FK memberships, cascade), `effective_from date`
- `method`: `'hourly' | 'per_session' | 'percent' | 'salary'`
- `amount_cents`: required for hourly (per hour), per_session (per session) and salary (per month)
- `percent_bps`: required for percent; 0–10000 basis points
- `format_overrides jsonb`: per_session only; `[{ formatName, amountCents }]` matched on the session format name in `bookings.title` or the package's session format. Fable should confirm which field identifies the format and document it.
- `pay_forfeited boolean default true`: whether a late family cancellation that forfeits credits still pays the coach
- `created_by`, `created_at`
- unique (`business_id`, `membership_id`, `effective_from`)
- checks matching the method rules above

RLS: **owner only**, for select, insert, update and delete. No policy for administrators or coaches. Add an RLS test proving administrators and coaches read zero rows.

### Coach profile for matching

Add to `memberships`:

- `specialties text[]`: subjects or tags such as "SAT Math" or "ADHD"; at most 30 entries, each 1–40 characters
- `max_clients integer`: null means no limit

Owners and administrators edit these on the Team page. Coaches can edit their own `specialties`. Whether the existing membership policies allow that needs checking; if they don't, use a server action that checks the role.

### Intake

`intake_settings` holds one row per business:

- `business_id` (PK)
- `enabled boolean default false`
- `intro text` (≤1000 characters)
- `questions jsonb`, using the same shape and validation as booking page questions (`questionsSchema` in `lib/booking/questions`)
- `notify_membership_ids uuid[]`: who gets new-inquiry emails; null means all owners and administrators
- `updated_at`

`inquiries`:

- `id`, `business_id`
- `stage`: `'new' | 'matching' | 'first_call' | 'offer' | 'enrolled' | 'lost'`
- Family contact: `contact_name`, `contact_email`, `contact_phone`, `relationship` (e.g. Parent, or "Self" for an adult student)
- `student_name`, `student_grade text`
- `subjects text[]`, `goals text` (≤2000), `availability_notes text` (≤1000), `timezone`
- `answers jsonb`: answers to custom questions, same shape as booking answers
- `source`: `'form' | 'staff'`
- `owner_membership_id`: the staff member responsible
- `coach_membership_id`: the proposed coach
- `first_call_booking_id` (FK bookings, set null)
- `client_id`: set on enrolment; composite FK to coaching_clients
- `lost_reason text`
- `next_action text` (≤200), `next_action_due date`
- `stage_changed_at`, `created_at`, `updated_at`
- index (`business_id`, `stage`, `stage_changed_at`), and an index on `coach_membership_id`

`inquiry_events` is an append-only timeline:

- `id`, `business_id`, `inquiry_id`, `actor_id` (null for the public form)
- `kind`: `'created' | 'stage' | 'assigned' | 'note' | 'first_call_booked' | 'first_call_outcome' | 'converted'`
- `data jsonb`, `created_at`

Add `bookings.inquiry_id` (FK inquiries, set null) so a first call links back. It's a plain guest booking: `booking_page_id` null, `coaching_client_id` null, `guest_email` set to the family contact.

RLS:

- **Owners and administrators:** full access to `intake_settings`, `inquiries` and `inquiry_events` for their business.
- **Coaches:** read `inquiries` where `coach_membership_id` is their own active membership, and read those inquiries' events. Insert `inquiry_events` of kind `note` and `first_call_outcome` on those inquiries only.
- **Anonymous users:** nothing. The public form submits through a server action using `adminDb`, with validation, a hidden honeypot field and rate limits:
  - at most 3 per email per business per hour
  - at most 30 per business per hour
- **Guardians** (family portal) never see inquiries. Add a test.

### Stripe fees

Add `bookings.stripe_fee_cents integer` and `bookings.paid_at timestamptz`.

- When a paid call is confirmed (`confirmPaidCheckout`), set `paid_at = now()`.
- Fetch the fee best-effort: retrieve the PaymentIntent on the connected account (`stripeAccount` option) with `expand: ['latest_charge.balance_transaction']` and store `balance_transaction.fee`. A failed fetch must never block confirmation; leave the fee null.
- Owners get a **"Sync Stripe fees"** action on the Finances page. It fills `paid_at` (from `created_at`) and missing fees for paid or refunded calls, in batches of 50.
- With direct charges, Stripe keeps its fee when a payment is refunded, so the fee stays a cost after a refund.

## Definitions (put these in `lib/insights/finance.ts` as pure, unit-tested functions)

All money is integer cents. Periods are calendar ranges in the **business's time zone**.

- **Cash collected** in a period:
  - paid calls: `price_cents` of bookings with a `paid_at` in the period whose payment status is paid, refunded or refund_failed
  - plus package payments: `client_credit_payments.amount_cents` with `received_on` in the period
- **Refunds** in a period: `price_cents` of bookings with `payment_status = 'refunded'`, counted on `cancelled_at`. Shown on its own line and subtracted: **net cash = cash collected − refunds**.
- **Delivered revenue**: revenue earned as sessions happen.
  - A paid call counts once its end time has passed and it wasn't refunded.
  - A coaching session counts when its credit is used (attended) or forfeited (late cancellation). Its value is the credit period's package price ÷ the period's credit units × the session's credit units. Read the price from `client_packages.terms`, and look at `lib/clients/credits` and `lib/coaching-packages.ts` for how terms are shaped.
  - Monthly packages: use the price for that period.
- **Prepaid, not yet delivered** (as of today): package payments received minus the delivered value of those periods, never below zero per period.
- **Owed by families** (as of today): the "due" amount from the existing credit balances logic, summed.
- **Coach pay** in a period, using the rate in effect on each session's date:
  - Delivered session: an attended coaching session; a paid call that ended and wasn't cancelled; or a forfeited late cancellation when `pay_forfeited` is on. Sessions cancelled for any other reason pay nothing.
  - `hourly`: duration in hours × rate.
  - `per_session`: the matching format override if there is one, otherwise the rate.
  - `percent`: percentage × the session's delivered revenue (above).
  - `salary`: monthly amount, prorated by days for partial months in the selected period and for the start and end of the rate. Sessions don't change it.
  - A coach with no rate counts as **0** and is flagged "No pay rate set" on the report. Never guess.
- **Stripe fees** in a period: `stripe_fee_cents` of paid calls with `paid_at` in the period. Calls with a missing fee are counted and shown as "N payments without fee data · Sync".
- **Profit** = revenue − coach pay − Stripe fees, with a toggle between two bases:
  - **Delivered** (default; revenue = delivered revenue). The help text says this matches pay to the work done.
  - **Cash** (revenue = net cash).
  - **Margin** = profit ÷ revenue, or "—" when revenue is 0.
- **Revenue by coach**: delivered revenue from sessions that coach hosted (`host_membership_id`). On the cash basis, attribute package payments to the client's assigned coach, and say so in the help text.

Unit tests must cover:

- each pay method
- a rate change in the middle of a period
- salary proration
- `pay_forfeited` on and off
- refunds across period boundaries
- a period boundary at local midnight in a non-UTC time zone
- a coach with no rate
- both bases

## Pages

Add **Dashboard** to the sidebar under Today for owners and administrators. On Free and Solo it shows a single upgrade card explaining what Team adds.

The route is `/app/dashboard`, with tabs:

### 1. Overview (`/app/dashboard`): owners and administrators

- **Attention queue**: rules computed live in `lib/insights/attention.ts` (pure rules plus a loader). Each item shows a short title, the client or inquiry, how long ago it happened, and a link or button to resolve it. Group by type, show counts, and collapse empty groups. Rules:
  - New inquiries not touched for over 24 hours. Overdue `next_action_due`.
  - Unpaid reservations whose payment cutoff is within 48 hours.
  - Credit periods with money owed. Periods ending within 14 days with unused credits. Active clients with ≤1 credit left.
  - Active clients (a session in the last 30 days or an open credit period) with **no upcoming session**.
  - Sessions that ended more than 48 hours ago and aren't marked attended.
  - Bookings with `calendar_sync_error` or `meeting_error`, and refunds that failed.
  - Coaches with no hours saved for this business, or whose Google Calendar connection needs attention.
- **Team load**: a table with one row per coach:
  - active clients / `max_clients`
  - booked hours in the next 14 days vs. bookable hours in the next 14 days, from their hours for this business minus time off
  - utilization %
  - sessions delivered in the last 30 days
  - Sorted by utilization. Clicking a row opens Assignments filtered to that coach.
- **Pipeline summary**: counts per stage, inquiries this month vs. last month, conversion rate (enrolled ÷ closed in the last 90 days), and median days from first contact to enrolled.

### 2. Intake (`/app/dashboard/intake`): owners and administrators; coaches see their own inquiries

- A board with one column per open stage (New, Matching, First call, Offer), and a list view toggle. Enrolled and Lost are filters.
- Moving between stages uses a stage menu on each card. Drag and drop is optional; keyboard and mobile must work without it.
- Cards show the student, contact, subjects, owner, proposed coach, days in stage, and next action with due date (red when overdue).
- **Inquiry page** (`/app/dashboard/intake/[id]`):
  - all details and answers, editable by owners and administrators
  - the timeline from `inquiry_events`, with a note box
  - assign owner and proposed coach, with match suggestions (below)
  - **Book first call**: pick the proposed coach's free times (reuse `freeTimes`/`availableStarts` logic for the coach in this business), meeting type and link (or Zoom if connected), then create a guest booking with `inquiry_id`. This sends the normal confirmation emails and adds the calendar event, and the stage moves to First call.
  - **First call outcome** (the coach or staff): Good fit, Not a fit, or No-show, plus a note. Good fit suggests moving to Offer; Not a fit suggests rematching (back to Matching, coach cleared).
  - **Convert to client**:
    - creates `coaching_clients` (name, email when the student is the contact, assigned coach = proposed coach) and a `client_guardians` contact from the family contact unless the relationship is "Self"
    - copies goals into the client record if a notes field exists; otherwise keeps them on the inquiry, linked
    - links `inquiries.client_id`, moves the stage to Enrolled, then opens the client page so staff can assign a package and invite the family to the portal (existing flows)
    - all in one transaction
    - converting twice must be impossible (unique `client_id`, plus a stage check)
  - **Mark lost**: a reason (preset list plus "Other") and an optional note.
- A **manual "Add inquiry"** form for staff (`source = 'staff'`).
- **Emails** (new templates in `emails.ts`, using the brand header):
  - to the family: an inquiry received confirmation
  - to the notify list: new inquiry
  - to the proposed coach: you've been asked to take a first call with X
  - Use idempotency keys.

### 3. Assignments (`/app/dashboard/assignments`): owners and administrators

- **Needs a coach**: inquiries in Matching without a proposed coach, and clients with no assigned coach.
- **Match suggestions** (`lib/insights/matching.ts`, pure and unit-tested). Score each eligible coach (active, `coaches = true`) and show the reasons as chips:
  - specialties overlapping the inquiry's subjects (strongest signal)
  - free time in the next 14 days (count of free 60-minute starts)
  - room under `max_clients`
  - current utilization (lower is better)
  - for an existing client with a package, whether the coach is in the package's `eligible_coach_ids`
  - Never auto-assign; staff choose.
- **Reassign**: move a client to another coach. This changes `coach_membership_id` only; future sessions stay with their host unless staff also move them, and the UI says so plainly.
- **Bulk reassign**: all of one coach's clients to others, for when a coach leaves.
- A **coach specialties and max clients** editor, linked from here and from Team.

### 4. Finances (`/app/dashboard/finances`): owner only

Administrators get a 404 or are redirected, and the tab isn't shown to them.

- Period picker (this month, last month, this quarter, year to date, last 12 months, custom), comparison with the previous period of the same length, and the basis toggle (Delivered or Cash).
- KPI tiles: revenue, coach pay, Stripe fees, profit, margin, each with the change from the previous period. Plus prepaid-not-delivered, owed by families and refunds.
- Charts:
  - monthly revenue, coach pay and profit for the last 12 months
  - revenue by coach
  - revenue by package (with paid calls as their own row)
  - margin by coach (their delivered revenue − their pay)
- No chart library is installed. Either add `recharts` (pin an exact version) or draw simple SVG bars. Follow the existing Tailwind tokens and support dark mode.
- A **coach pay report** for the selected period, one row per coach: method, sessions, hours, amount, and flags such as "No pay rate set". Expand a row to see sessions. **Export CSV** for the report and for a transaction list (date, client or guest, coach, type, amount, fee, refund).
- **Sync Stripe fees** button (see Data model).

### 5. Settings

- **Settings → Coach pay** (owner only): one row per coach with their current rate. Edit opens a form (method, amount or percent, format overrides for per-session, pay for forfeited sessions, effective from). Show the history of past rates.
- **Settings → Intake form** (owners and administrators): enable, intro text, questions (reuse the booking page question editor), who gets notified, and the public link with a copy button.

### Public inquiry form

- `/b/[business]/inquire`, linked from the business's public page (`/b/[business]`) when intake is enabled and the business is on Team.
- Fields: contact name, email, phone (optional), relationship, student name, grade, subjects (free text split into tags), goals, availability notes, the business's custom questions, and the time zone (detected and editable).
- Validate with zod in `lib/validation`.
- Confirmation screen; no account needed (D-014).
- When intake is disabled or the plan has lapsed, show "This business isn't taking inquiries online" with the contact email if one is set.

## Plan gating

- Add `teamDashboard: boolean` (true only on Team) to `planLimits`, and an `UPGRADE_MESSAGES.teamDashboard`.
- Check it in every page, server action and the public form. The UI check alone isn't enough.
- Use the same rule as reminders: a complimentary subscription counts, as does an active, trialing or past_due one in the current Stripe mode.

## Permissions summary

| | Owner | Administrator | Coach | Guardian |
|---|---|---|---|---|
| Overview (attention, load, pipeline) | ✓ | ✓ | — | — |
| Intake board and all inquiries | ✓ | ✓ | Their proposed-coach inquiries only (read, notes, first call outcome) | — |
| Assignments | ✓ | ✓ | — | — |
| Finances, coach pay report, CSV | ✓ | — | — | — |
| Settings → Coach pay | ✓ | — | — | — |
| Settings → Intake form | ✓ | ✓ | — | — |
| Edit specialties / max clients | ✓ | ✓ | Own specialties only | — |

Enforce every row in the database (RLS) where the data is a table, and in the server action or loader where it's an aggregate. Finances loaders must check the owner role before running queries.

## Verification (definition of done)

1. **Run every command from `app/`:**
   - `npx tsc --noEmit`
   - `npx vitest run --project unit`
   - DB tests:
     - start Postgres with `pg_ctl -D <scratchpad>/pg -o "-p 55432 -k ''" start`
     - create the database if needed, then run `TEST_DATABASE_URL=postgres://postgres@localhost:55432/sf_test npx vitest run --project db`
2. **New RLS tests in `tests/db/rls.test.ts`:**
   - administrators and coaches can't read `coach_pay_rates`
   - a coach sees only inquiries they're the proposed coach on and can't change their stage
   - a coach can't read another business's inquiries
   - a guardian sees no inquiries
   - an anonymous user can't read or insert inquiries directly
   - converting an inquiry twice fails
3. **Unit tests for:**
   - finance definitions (the list above)
   - attention rules (each rule, with edge times)
   - matching scores and reasons
4. **Apply the migration to the dev Supabase project only** (`agfwvmihdjmwftbvlefh`) and run the security advisors afterwards. Production gets migrations automatically on deploy.
5. **Click through on the dev server** (`preview_start` "app"):
   - submit the public form
   - see the inquiry on the board and the emails in the log
   - assign a coach using a suggestion
   - book a first call (check the confirmation email and the calendar event)
   - record the outcome, move to Offer, convert to a client
   - see the attention queue and team load
   - set two coaches' pay (one hourly, one per session), mark a session attended, and confirm the Finances totals by hand against the database
   - export the CSV
   - check dark mode and a 375px-wide screen
   - check that an administrator can't open Finances (404) and that a Solo business sees the upgrade card
6. **Clean up test data** created on dev, or list what was left.

## Out of scope for this slice

- contracts and e-signing (DocuSeal)
- online payment for offers, and package card payments or instalments
- manual business expenses
- coaches seeing their own earnings
- payroll payouts
- SMS
- AI matching
- a custom pipeline builder (stages are fixed)
- duplicate detection beyond showing "An inquiry from this email already exists" with a link

## Constraints

- **Supabase:** don't touch any Supabase project other than dev (`agfwvmihdjmwftbvlefh`). Never put secret or service-role keys in code or chat.
- **Git:** don't commit or push unless the founder asks, and leave `.mcp.json` out of commits.
- **Copy:** match the existing style: plain words, short sentences, no jargon, the curly apostrophe ’ in UI text.
- **Docs:** add D-074 to the decision log in `docs/PRODUCT_PLAN.md` and a row update to `docs/ROADMAP.md` when done.
