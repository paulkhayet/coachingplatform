# schedulefa.st landing page

A responsive, pre-launch marketing website for the planned coaching SaaS. The brand uses the user-owned domain schedulefa.st. Copy and pricing are creative proposals. Product illustrations use sample data and are clearly labeled.

The current design uses a lowercase schedulefa.st wordmark, a fast-forward symbol, a clean black-and-white SaaS layout, restrained blue accents, and DM Sans throughout. The hero leads with “Streamline your entire coaching business.” Calendly's landing page was used as a reference for clear hierarchy and direct product messaging. Marketing body copy is generally 16–18px, with bold sans-serif headings. The illustrative workspace shows client intake, contracts, sessions, and follow-ups.

## Run locally

Requires Node.js 20 or later. There are no package dependencies to install. Run these commands from the `landing/` folder.

```sh
npm start
```

Open the printed URL, normally http://127.0.0.1:4173. Use `npm run dev` to restart automatically when server files change, and `npm run check` for JavaScript syntax checks.

To choose another port:

```sh
PORT=4174 npm start
```

## Included

- Responsive desktop/mobile layouts and mobile navigation.
- Three accessible workflow previews with keyboard navigation.
- Monthly/yearly pricing with accurate annual totals.
- Early-access dialog, validation, success/error states, and a local signup endpoint.
- FAQ accordions, reduced-motion support, local fonts, and basic social metadata.

## Early-access requests

When the Node server is running, submissions are stored in `data/waitlist.jsonl`. Each record contains email, plan preference, billing preference, and creation time. The endpoint validates input, deduplicates email addresses, limits request sizes/rates, and does not expose the signup file through the website.

No email is sent, no payment is collected, and no SaaS account is created. A production email/CRM service, deployment, and production data policies still need to be connected before public launch. Opening `index.html` directly previews the design; form submissions require the server.

`WAITLIST_FILE` can override the storage path for isolated QA. `HOST` and `PORT` configure the preview server. Keep signup data outside public assets and out of source control.

## Proposed pricing

| Plan | Staff | Monthly | Annual equivalent | Annual total |
| --- | --- | --- | --- | --- |
| Solo | 1 | $39 | $31/month | $372 |
| Studio | Up to 5 | $99 | $79/month | $948 |
| Practice | Up to 15 | $199 | $159/month | $1,908 |

The full planned coaching workflow is positioned across every tier; staff capacity differentiates the plans. These are proposed launch prices, not live offers. The domain was provided by the owner. This local rebrand does not configure production hosting, DNS, or email delivery.

## Verification and previews

Verified in Chrome at 320px, 390px, 768px, and the normal 1920px desktop viewport, with no horizontal page overflow. Checked mobile navigation, workflow-tab keyboard navigation, monthly/yearly prices and annual totals, FAQ expansion, plan selection, and the complete browser-to-file signup flow. Invalid emails are rejected, duplicate signups are suppressed, and private files are not publicly served. No browser console errors were observed.

Saved design previews are in `previews/desktop.png`, `previews/mobile.png`, and `previews/hero.png`. QA signup data used a separate temporary storage path, leaving the actual waitlist empty.

The active DM Sans font is self-hosted with its Open Font License in `assets/`. Instrument Serif assets from the earlier design remain bundled but are not loaded by the current page.
