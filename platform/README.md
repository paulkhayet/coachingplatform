# schedulefa.st — product prototype

A clickable, full-journey prototype of the schedulefa.st coaching platform, built from
[`docs/PRODUCT_SPEC.md`](../docs/PRODUCT_SPEC.md) (v0.1) and [`docs/PRODUCT_PLAN.md`](../docs/PRODUCT_PLAN.md) (decisions through D-049).

It runs entirely in the browser. All data is sample data, stored in `localStorage`, and the
business rules run for real: credit funding, booking checks, permissions, cancellations,
follow-up delivery, and staff-seat limits. External services are simulated.

## Run it

```sh
cd platform
npm install
npm run dev        # http://localhost:5174
npm run build      # typecheck + production build into dist/
```

Start at `/`. Choose a person to see the product from their side. The avatar menu has
"Reset demo data" and links to switch people. Dark mode follows the system and can be toggled.

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui-style components on Radix
(`src/components/ui`), Zustand for state, date-fns, and lucide icons. The brand theme is in
`src/index.css`: DM Sans, brand-blue primary `#385be8`, a 7px radius, and Instrument Serif
for family-facing headings.

## What's covered

| Area | Where | Spec |
| --- | --- | --- |
| Booking pages (Calendly-style): free or paid calls, custom questionnaires, host selection or "any available" round robin, notice/window/buffer limits | Staff → Booking pages; public `/b/willow-coaching` | §5, Q-03 |
| Guest booking: month calendar → time → questionnaire → Stripe checkout → confirmation; the manage link reschedules or cancels with the refund cutoff | `/b/willow-coaching/:page`, `/booking/:token` | §5, §10 |
| Public inquiry form (no account), direct or team workflow | `/b/willow-coaching/inquiry` | §5, P-05 |
| Inquiry queue: coach match, handoff notes, fit call, outcome, offer builder, revised offers | Staff → Inquiries | §4, §5 |
| Guest offer: choose → sign → Stripe checkout (success or decline) → enrollment and portal invite | `/offer/:token` | §5, §6, P-06 |
| Credits: proportional installment funding, monthly cycles, chronological reservation funding, makeups after term end, audited adjustments | `src/lib/credits.ts` | §8, §9, D-023/D-024 |
| Booking: availability minus Google busy time and buffers, notice/window, entitlement and funding checks, recurring-series preview, reschedule | `src/lib/booking.ts`, booking dialog | §10, P-10 |
| Funded-only vs advance reservations; unpaid auto-release at the cutoff ("Run scheduled jobs") | Settings, Today | D-025/D-026 |
| Cancellations: policy snapshot, timely/late/business outcomes, recorded staff exceptions | Cancel dialog | §11, P-11 |
| Attendance blocked without paid coverage; price-free "Eligible / Payment needed" for coaches | Session page | §10 |
| Zoom summary import, manual notes/transcript fallback, private notes, drafts (student/parent/shared), per-recipient permission checks, publish once | Session page | §13, P-13 |
| Coach-written homework, completion responses, file sharing | Session, Client, Portal | §14 |
| Roles: owner/admin/coach; coaches never see prices; pool-booking and explicit grants with expiry; private-note grants | `src/lib/permissions.ts` | §3, P-02 |
| Family relationships: separate guardian logins and permissions, payer/signer, independent students | Client → Overview, Portal | §3, P-03 |
| Existing clients by manual entry with verified historical coverage | Clients → Add existing client | §6, D-045 |
| Reminders (email 24h/1h, opted-in SMS 2h, quiet hours) recalculated per appointment version; message log | Session, Settings | §12 |
| Issue queue with owners and history (failed payment, stale calendar, missing summary) | Issues | §18 |
| Staff seats, invitations reserving seats, guided downgrade blocked by unresolved sessions | Team, Plan and billing | §15, D-048 |
| Student and guardian portals: book, reschedule, cancel, follow-ups, homework, files, billing | `/portal` | §16 |

## Booking pages

Each booking page has a name, link, duration, location (Zoom, in person, phone), hosts, an optional
price and refund cutoff, booking limits, and a questionnaire. Question types are short answer,
paragraph, one choice, multiple choice and phone, each with a required flag and ordering. Name and
email are always asked; student name and grade are optional.

A booking creates (or reuses, matched by email) an inquiry, so it joins the normal pipeline. Answers
and payment status show on the session and the inquiry. Coaches see "Paid call" but no amounts.
Paid calls never enroll anyone or create session credits. Cancelling before the refund cutoff, or
any cancellation by the business, refunds automatically. Charging for intro calls was an open
question (Q-03) in the product plan; this prototype assumes the business may.

## Simulated, not built

- **Stripe, Zoom, Google Calendar, e-signing, SMS:** in-app simulations with buttons that
  fire the provider event. These providers aren't chosen or set up yet (Q-01–Q-04).
- **AI follow-ups:** a deterministic template that rewrites the permitted source. The model
  provider isn't selected.
- **No server, no authentication, one sample business.** The "Viewing as" switcher stands in
  for logins. The isolation rules are modelled but not enforced by a backend.
- **Prices and allowances** are the marketing site's candidate figures, not decisions.
- Refunds/disputes, ownership transfer, data export/deletion, and SaaS failed-payment
  recovery are described in the spec and left out here.

## Layout

```
src/lib/        types, seed data, store (all actions), credits, booking, permissions, follow-ups
src/components/ shadcn-style UI kit + booking/cancel dialogs, credit summary, status badges
src/layouts/    staff sidebar layout, family portal layout
src/pages/      staff/*, portal/*, public/* (launcher, inquiry, guest offer)
```
