# schedulefa.st

Business software for coaching businesses that work with middle school, high school and college students. It covers the whole journey from first inquiry to coaching and follow-up: booking pages, intake, offers and e-signing, payments, scheduling, session credits, family portals, and AI-assisted follow-ups.

## What's in this repository

| Folder | What it is | Run it |
| --- | --- | --- |
| [`docs/`](docs) | Planning documents: [product plan and decision log](docs/PRODUCT_PLAN.md), [product spec](docs/PRODUCT_SPEC.md), [tech stack](docs/TECH_STACK.md), [competitive analysis](docs/COMPETITIVE_ANALYSIS.md) | — |
| [`platform/`](platform) | Clickable product prototype covering every surface in the spec, with business rules running in the browser on sample data | `npm --prefix platform install` then `npm --prefix platform run dev` → http://localhost:5174 |
| [`landing/`](landing) | Pre-launch marketing site with an early-access waitlist | `npm --prefix landing start` → http://localhost:4173 |

Both apps need Node.js 20 or later.

## Status

- **Planning:** decisions D-001 to D-052 are confirmed in the product plan. The spec marks everything else as proposed or open.
- **Prototype:** a demo, not a production app. There's no backend; data lives in the browser, and Stripe, Zoom, Google, DocuSeal, SMS and AI drafting are simulated. See [`platform/README.md`](platform/README.md).
- **Production stack** (decided, not yet built): Next.js on Vercel, Supabase (Postgres, Auth, Storage, jobs), Stripe Connect and Billing, DocuSeal Cloud, Resend, Twilio, and the OpenAI API. See [`docs/TECH_STACK.md`](docs/TECH_STACK.md).
