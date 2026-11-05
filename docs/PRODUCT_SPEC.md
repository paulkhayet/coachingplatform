# schedulefa.st — Product Specification

Version 0.1 · November 5, 2026 · First consolidated review draft

## Reading this specification

This document brings the product's launch scope, user journeys, screens, business rules, exceptions, and acceptance scenarios into one reviewable specification. No SaaS application implementation is authorized or begun by this draft.

The [product plan and decision log](PRODUCT_PLAN.md) remain the authority for confirmed decisions, through D-052. The technology choices are in [TECH_STACK.md](TECH_STACK.md). This specification organizes those decisions and fills the connecting gaps with recommendations. If they conflict, the latest confirmed decision in the product plan takes precedence; correct the specification before implementation.

- **Confirmed — D-xxx:** The founder explicitly selected this capability or policy.
- **Proposed — P-xx:** A recommended launch behavior for review. Writing it here does not approve it.
- **Open — Q-xx:** A material unresolved question or validation dependency, collected in section 21.
- **Outside launch:** Explicitly deferred by a confirmed decision, or labeled as a proposed exclusion where the founder has not decided it.

Approve changes by recording the relevant decision in the product plan and updating this document. An answer to a single question does not approve the rest of this draft. Financial, permission, and integration examples illustrate behavior; they do not establish universal customer policies or legal/provider feasibility.

## 1. Purpose and intended outcome

**Confirmed:** Build configurable business software for solo coaches and small coaching teams. Initially serve businesses coaching middle school, high school, and college students, including parent involvement; expand across coaching specialties over time. Launch for U.S.-based coaching businesses using USD. The brand/domain is schedulefa.st. D-001–D-003, D-010, D-019–D-021, D-046.

The product should connect the complete administrative journey: interest → intake → consultation and staff handoffs → offer and signature → payment → client access → scheduling → coaching → follow-up and homework → renewal or completion. Its core value is fewer manual scheduling messages, meeting-link reminders, handoffs, and follow-up tasks.

One coach's practice supplied useful examples. Its program lengths, prices, cancellation thresholds, and audience preferences are not mandatory defaults for other businesses.

**Proposed — P-01: operational foundation.** Each coaching business has its own workspace, records, permissions, settings, and subscription. A solo owner can also administer and coach using one staff membership. A team uses the same model with additional memberships. Business data must be isolated from other businesses in every screen, background action, export, and integration. Multi-business membership and workspace switching are open; they are not a promised launch feature.

**Proposed success measures:** Track manual administrative actions per completed coaching session, time from inquiry to enrollment, successful self-service bookings, reminders delivered, follow-ups completed, and unresolved operational issues. Establish baseline measurements with pilots before setting numeric improvement promises. Student educational outcomes and revenue growth are not guaranteed by the software.

## 2. Confirmed launch boundary

| Area | Confirmed launch capability | Boundary / reference |
| --- | --- | --- |
| Customers | Student-coaching businesses; solo operators and small teams | U.S.-based businesses, USD; overseas family eligibility remains open. D-020, D-021, D-046. |
| Staff | Owner, administrator, coach; supported permissions and client assignments | No custom role builder. Pricing access belongs only to owner/admin staff. D-015, D-027. |
| Enrollment | Configurable guided solo/team workflows with handoffs and intake questions | No arbitrary workflow automation builder. D-013, D-022. |
| Guest booking | Calendly-style booking pages for calls such as consultations; each free or paid, with an attached questionnaire | A paid call does not enroll anyone or create coaching credits. D-049. |
| Client access | Guest pre-enrollment and checkout; portal setup after successful coaching payment | Multiple guardian logins with separate permissions; independent students need no parent account. D-014, D-032. |
| Offerings | Fixed-term bundles and ongoing monthly coaching; flexible session formats | Session-credit accounting, including configured fractional costs. D-023; R-003–R-007. |
| Funding | Fixed-term installment payments fund credits proportionally | Paid coverage required before coaching delivery. D-016, D-024. |
| Reservations | Business chooses funded-only booking or future reservations ahead of coverage | Reminders, staff alerts, optional automatic cancellation at the business's chosen cutoff. D-025, D-026. |
| Teams/pools | Assigned coaches and optional shared coach pools | A purchase's allowance works across eligible coaches within that business. D-012, D-017, D-029–D-031. |
| Scheduling | Flexible and recurring appointments; Google Calendar connections | Automatic Zoom links; manual meeting links/locations. D-004, D-038, D-039. |
| Notifications | Email plus optional SMS appointment reminders for opted-in recipients | Providers, quotas, costs, sender configuration, and detailed preferences remain open. D-047. |
| Coaching | Focused portal, shared follow-ups, homework, and files | Homework is manually written by coaches. D-033, D-037. |
| AI follow-ups | Automatic Zoom-summary input; manual notes/existing-transcript fallback | Manual approval and optional business-enabled automatic sending; student/parent or shared versions. D-034–D-036. |
| Commercial integrations | Integrated guest e-signing through DocuSeal; Stripe coaching payments | Stripe account/fund-flow model remains open. D-040, D-041, D-051. |
| SaaS | Ongoing limited free plan; paid staff-capacity tiers | No schedulefa.st coaching transaction fee. Prepare staff reductions before voluntary downgrade; preserve records. D-042–D-044, D-048. |
| Existing clients | Manual entry | CSV imports and source-specific migration tools outside launch. D-045. |

**Confirmed outside launch:** Custom workflow and role builders; dedicated student goal/progress dashboards; private student journaling; in-app messaging; AI homework generation; automatic Google Meet; Outlook/Microsoft 365 coach connections; PayPal; CSV/platform migration tools; additional business countries/currencies. No expansion date is committed. SMS selection does not establish two-way texting or SMS coaching-summary delivery. Coach payroll, marketplace discovery, group coaching, and custom domains have no confirmed launch scope.

## 3. People, relationships, and access

**Confirmed:** Owners set business defaults and supported permissions. Coaches control availability and permitted non-pricing arrangements. Administrators not acting as the client's coach start with operational information for authorized clients; private coaching notes/transcripts need an explicit grant. Coaches initially see assigned or explicitly authorized clients. D-011, D-015, D-027–D-029.

**Proposed — P-02: permission model for review.** Check both the permitted client set and the permitted content/action. Assignment, scheduling authority, content visibility, pricing access, and financial actions are separate. Individual exceptions must name their scope and be recorded. The table combines confirmed limits with proposed action defaults; it does not approve those proposed defaults.

| Action/content | Owner | Administrator | Coach-only staff |
| --- | --- | --- | --- |
| Pricing | Confirmed access | Confirmed access | Confirmed no access |
| SaaS billing, staff roles, owner permissions | Proposed manage | Proposed no access unless specifically delegated | Proposed no access |
| Authorized-client schedules, enrollment, contracts, payment information | Proposed manage | Confirmed operational viewing; proposed ordinary operational editing | Proposed only scheduling context and a price-free eligibility status |
| Offers, contract terms, client payment schedules | Proposed manage | Proposed manage within delegated financial actions | No pricing access; proposed no commercial-document access |
| Refunds, credits affecting money, payout/account changes | Proposed separate sensitive actions | Proposed explicit delegation required | Proposed no access |
| Private coaching notes, raw summary/transcript | Proposed explicit content grant or coaching assignment, not blanket access from ownership alone | Confirmed explicit grant required when not the client's coach | Proposed author's own content and specifically shared/authorized content |
| Homework and follow-up authoring | Proposed when acting as authorized coach | Proposed only with specific coaching/content permission | Proposed for authorized clients |
| Send/publish to families | Proposed separate recipient/content checks | Proposed explicit content/send permission | Proposed for authorized clients and audiences |
| Export/delete | Proposed scoped action with confirmation and audit history | Proposed explicit delegation | Proposed no bulk export/delete by default |

For dual-role staff, preserve the pricing restriction for coach-only accounts and apply the relevant coaching assignment/content permissions. An administrator's default operational access is not permission to read private source material while coordinating follow-ups.

**Confirmed pool access:** A confirmed pool booking grants the booked coach the access allowed by business settings by default. The booking-created grant ends after that coach's booked sessions and a configurable follow-up window. Owners may configure the policy; independent assignment/grant access follows its own rules. D-030, D-031. **Proposed detail:** Show why access exists and its expiry; cancel/reassign booking-created grants without accidentally revoking independent grants. The follow-up-window duration still requires review.

**Proposed — P-03: family relationships.** Keep the student, guardian, payer, signer, and portal user as distinct relationships. One person may fill several roles. Paying or signing does not automatically confer access to all student content. Invitations and guardian/student links require verified identity and authorized relationship approval. Proposed separate controls cover booking, rescheduling/canceling, joining sessions, follow-up versions, homework/files, and commercial documents. Sibling linking, age transitions, and guardian authorization/consent rules need review under Q-02.

## 4. Complete solo and team journey

This walkthrough preserves confirmed capabilities; its connecting actions and task ownership are **proposed — P-04**. The team example has one CEO, one administrator, and ten coaches: twelve staff accounts, not a confirmed pricing tier.

| Stage | Solo owner-coach | CEO + administrator + ten coaches | System assistance proposed |
| --- | --- | --- | --- |
| Establish business | Owner creates business and configures it | CEO creates business, invites staff, sets permissions | Setup checklist; missing integration/settings warnings |
| Set services | Owner defines offerings, policies, and payment choices | CEO/admin handles commercial setup; coaches manage availability | Preview family-facing terms and booking eligibility |
| Receive interest | Owner reviews guest intake | Admin reviews intake and assigns a next action | Save prospect, source, stage, responsible staff |
| Match and consult | Owner books/holds the first call | Admin matches coach; coach holds first call | Synced availability, meeting details, reminders, handoff task |
| Resolve fit | Owner proceeds, follows up, or declines | Coach reports permitted fit outcome; admin rematches or proceeds | Open/declined/waiting statuses; no private-note disclosure in handoff |
| Agree service | Owner discusses offer and contract | CEO/admin discusses money and sends offer/contract | Guest review/signing; track contract state |
| Pay and activate | Family pays; owner resolves missing requirements | Family pays; admin handles commercial exceptions | Verified payment funds credits; post-payment portal invitation |
| Book coaching | Recurring slots or permitted family self-booking | Assigned-coach or enabled pool booking | Policy/credit/conflict checks; Zoom/calendar details |
| Attend | Owner delivers paid-covered session | Booked coach delivers paid-covered session | Price-free coach eligibility, reminders, attendance outcome |
| Follow up | Owner reviews/sends or uses configured automatic mode | Authorized coach/process prepares permitted audience versions | Retrieve summary, prepare drafts, deliver once, show failures |
| Continue | Owner writes homework, handles changes and makeups | Coach handles coaching; admin coordinates operations | Track homework, cancellation policy, makeup eligibility, outstanding tasks |
| Renew/finish | Owner handles commercial decision and completion | Coach contributes progress context; admin handles commercial steps | Renewal/completion task; retain authorized access as defined |
| Staff/plan changes | Owner manages recovery or downgrade | CEO reassigns work and prepares staff changes | Guided handover, access changes, preserved records |

Every stage must identify its next responsible person. A prospect can decline, wait, fail to respond, request a different coach, or return later without creating duplicate client histories.

## 5. Guided intake, offers, and signing

**Confirmed:** Guided configurable solo/team intake flows, guest commercial steps, integrated guest e-signing with automatic status updates, and owner/admin-only staff pricing. D-013–D-015, D-022, D-040.

**Proposed — P-05: bounded workflow templates.** Start with (1) direct consultation and (2) administrator review → coach match → consultation → administrator commercial follow-up. Allow supported steps on/off and responsible roles; do not introduce arbitrary branching code or a custom workflow builder.

Proposed intake fields: student name and age/education stage, contact and authorized relationship, goals/needs, availability/timezone, referral source, and optional business-authored questions. Only collect what the business needs. Coach-facing fit notes and administrator handoff notes are separate from private session notes. Public/guest links are scoped to their intended action and disclose no unrelated records.

**Confirmed — D-049: guest booking pages.** Prospects book calls such as consultations from Calendly-style booking pages without an account. Each business configures every call as free or paid and can attach a questionnaire. All ongoing coaching still requires paid coverage. Do not treat a paid consultation as enrollment, and do not treat an unpaid coaching session as an allowed exception.

**Proposed — P-21: booking-page details for review.** Each page sets a name, link, duration, location (automatic Zoom link, in person, or phone), hosts (one coach, or several with the guest choosing a coach or being assigned to any available one), optional price and full-refund cutoff, minimum notice, booking window, and buffer. Name and email are always collected, plus optional student name and grade and business-authored questions (short answer, paragraph, one choice, multiple choice, phone; each can be required). A booking creates an inquiry, or reuses an open one for the same email, and assigns a task to the host. The guest receives an expiring manage link to reschedule (no new charge) or cancel. A paid call is refunded automatically if the guest cancels before the cutoff or the business cancels. Answers and payment status are visible to authorized staff; coach-only staff see that a call is paid but not the amount. Automatic routing, refund defaults, payment provider behavior and question limits remain proposals under Q-01, Q-03 and Q-04.

**Proposed offer/signing flow:** Owner/admin selects or customizes an offering, chooses the payment arrangement, and sends a guest offer. Family selects its option before the final contract version is presented for signing. Freeze the accepted price, service allowance, payment schedule, and policy version. Require the configured authorized signers; then present guest checkout. Business countersignature and additional student/guardian signers depend on the approved signing policy and provider.

Changing material terms creates a new offer/contract version and explains what must be accepted again. Proposed states: draft → sent → accepted/signing → signed; alternatives declined, expired, voided, or replaced. Payment and contract status remain separate. If a payment arrives before a required signature, allow post-payment portal setup but keep enrollment pending until the remaining requirements are resolved. Never issue duplicate contracts or charges when provider notifications repeat.

Legal sufficiency, signing authority, required signers, provider costs, and signature evidence/retention remain validation work, not claims made by this draft. Q-02, Q-04.

## 6. Payment, activation, and existing-client entry

**Confirmed:** Use Stripe first for coaching payments. Fixed-term installments fund credits proportionally. Successful coaching payment precedes portal setup; delivery needs paid coverage. Existing clients are entered manually; no CSV or platform migration tools. D-014, D-016, D-024, D-041, D-045.

**Proposed — P-06: activation and identity.** A verified provider payment event, reconciled to the correct business/purchase, establishes successful payment; a browser's checkout-success page alone does not. Keep the prospect history and add enrollment rather than duplicating the person. Invite the authorized parent/student contacts configured for that enrollment, not automatically every payer or intake contact. Verify control of an email/account before linking existing identities. Record each guardian's relationship and permitted student access separately.

Use distinct states for commercial acceptance, payment, enrollment, and portal access. Proposed enrollment states: prospect → pending requirements → active → completed/ended, with paused status only if an approved policy supports it. Portal invitation follows payment, even if other enrollment requirements still need resolution. Partial payment can satisfy the post-payment invitation condition while funding only proportionate session credits. Account creation does not authorize unrestricted booking.

For existing clients, proposed manual setup covers student/contact relationships, assigned coach or pool, existing agreement reference, current term, future appointments, and opening entitlement/paid balances. Only authorized financial staff can establish verified historical paid coverage, with provenance, amount/credit basis, and audit history. Record imported historical coverage distinctly from a new Stripe charge. This is a proposal requiring approval; it is not an approved general offline-payment or complimentary-credit feature. Unverified balances stay pending, and neither manual entry nor account invitation establishes payment. Already-paid clients should not be charged again solely to move systems.

The Stripe account model, merchant/fund ownership, onboarding, payment methods, allocation of provider fees, refunds/disputes, tax treatment, and historical-payment authority remain open. schedulefa.st's own subscriptions use Stripe Billing on the same Stripe account (D-052). Q-01, Q-03, Q-04.

## 7. Offerings and configuration precedence

**Confirmed:** Support fixed-term bundles and ongoing monthly arrangements, configurable program length/frequency, permitted session splits, expiration, cancellation/absence rules, authorized exceptions, and makeups beyond the original end date when eligible. Measure allowance in session credits with defined session-type costs. Owner-governed customization and staff pricing restrictions apply. D-005–D-011, D-023.

**Proposed — P-07: bounded configuration model.** Reusable offerings supply defaults; accepted client agreements preserve a versioned snapshot. Apply business defaults → explicit offering terms → accepted client-specific terms → authorized individual-session exception. Permission checks remain mandatory at every level. An override cannot remove the paid-before-delivery or coach-only pricing restrictions.

| Configuration | Proposed launch treatment |
| --- | --- |
| Service | Name, coaching purpose, eligible session types and coaches/pools |
| Allowance/term | Purchased credits, start/end or billing period, planned frequency |
| Session type | Duration, credit cost, permitted location/meeting arrangement; duration alone does not determine cost |
| Money | USD price, upfront/installment/monthly choice; owner/admin only |
| Booking | Funded-only or advance reservations, booking window, notice, buffers, permitted parent/student bookers |
| Cancellation | Business-selected notice threshold, timely/late/no-show outcomes, exception authority |
| Expiration/makeup | Ordinary expiry, preserved-makeup eligibility and deadline, treatment past program end |
| Follow-up | Manual/automatic mode, allowed audiences, templates and publication rules |
| Reminders | Email schedule, optional SMS, recipients/preferences, timezone treatment |

Require the business to choose material cancellation/expiry terms before publishing an offering; do not silently apply the example 24-hour rule. Coaches may alter only delegated non-pricing fields. Changing defaults affects new agreements/bookings unless an explicit, reviewed update process addresses existing records. Material changes to an accepted agreement need a new version and appropriate acceptance/communication. No arbitrary mid-program price rewrite is proposed.

## 8. Credits, funding, reservations, and adjustments

**Confirmed accounting invariant:** For an unchanged fixed-term purchase without adjustments, cumulative funded credits = purchased credits × cumulative successful package payments ÷ agreed package price, capped at the purchased quantity. This is a funded total, not the remaining usable balance. D-023, D-024.

Example: a $1,200 purchase containing 12 credits, paid in three $400 installments, funds 4, then 8, then 12 credits cumulatively. Reserving one funded credit reduces free funded availability from 4 to 3. Completing that appointment consumes the reserved credit; 3 remain usable. Two permitted half-credit appointments consume one credit total. These example prices and credit costs are not platform defaults.

**Proposed — P-08: auditable credit lifecycle.** Record purchases, funding changes, reservations, consumption, forfeitures, releases, expiration, preserved makeups, and authorized adjustments as traceable events. Corrections should explain the previous event rather than erase history. Keep financial payment amounts separate from coach-facing credit eligibility.

Expose distinct balances: purchased entitlement, cumulative funded total, funded/unfunded reservations, consumed/forfeited entitlement, expired entitlement, eligible makeups, and currently usable funded credits. Funding alone cannot restore a credit already consumed, forfeited, or expired. Booking and completion must not spend the same credit twice.

Proposed precision is hundredths of a credit, with funded availability rounded down and the residual preserved until later payment/final reconciliation; final full payment funds the exact purchased quantity. The proposed funding basis is the agreed coaching-service price after discounts, excluding separately identified taxes/provider charges. Both rules need financial review and provider validation before implementation.

For advance reservations, reserve purchased entitlement without pretending it is funded. Proposed allocation applies funding to prior consumed/forfeited obligations first, then upcoming reservations in chronological order within that purchase, with deterministic tie handling. A late-cancellation penalty on an unfunded reservation would record a forfeiture against purchased entitlement awaiting funding; it would not represent delivered unpaid coaching or create an additional cash charge. This edge-case policy is proposed, not confirmed, and must be reviewed under Q-03.

Refunds/reversals must be reconciled to the purchase and funding history. Proposed behavior: preserve historical attendance, calculate any resulting shortfall, flag affected future reservations, and block uncovered delivery. Do not erase a completed session or cancel every future appointment merely because one payment changes. Material price changes, zero-price coaching, complimentary credits, dispute outcomes, and partial-refund allocation remain unresolved; no arbitrary staff balance-edit feature is approved.

One allowance belongs to its client's purchase within the business. Eligible coaches use that same allowance; changing coaches does not duplicate or replenish it. Cross-student, cross-business, or arbitrary cross-service balance transfers are not established.

## 9. Ongoing monthly arrangements

**Confirmed:** Ongoing monthly coaching and ordinary unused-credit expiration are supported configurable capabilities. Proportional fixed-term funding does not itself decide monthly funding rules. R-003, R-006, R-007; D-024.

**Proposed — P-09: launch monthly model.** Each agreed billing/service cycle has a defined credit allowance and dates in the business timezone. A successful full cycle payment funds that cycle's allowance; failed or pending payment funds none. No partial-cycle proration, custom per-installment funding schedule, or retroactive mid-cycle service conversion is proposed for launch. The supported cycle anchor and change/cancellation rules need review.

The offering must specify unused-credit expiration and any supported carryover. Preserve eligible makeup credits under their own deadline, even when the ordinary cycle expires. Funding for a later period must not silently reset old forfeitures, ordinary expired credits, or a separate makeup deadline.

Stopping renewal should stop future charges according to the accepted arrangement while preserving existing paid entitlements subject to their policies. It does not automatically refund money or erase scheduled appointments. Pauses, holidays, coach absence, failed renewals, and ending a contract with outstanding installments need explicit supported outcomes. Recommend next-period changes or a new agreement for complex changes; exact limits remain Q-03 proposals.

## 10. Booking, recurring sessions, and meeting details

**Confirmed:** Flexible self-booking and recurring sessions; parent/student booking rights chosen per client; optional pools and shared allowance; Google Calendar-only coach connections; automatic Zoom links with manual alternatives. The business chooses funded-only booking or advance reservations. Optional auto-cancellation applies at its chosen cutoff. D-004, D-005, D-012, D-017, D-025, D-026, D-038, D-039.

**Proposed — P-10: booking flow.** Select student/enrollment → eligible service and coach/pool → available slot → show duration, credit cost, timezone and applicable cancellation terms → confirm. Recheck availability, permissions, remaining purchased entitlement, and required funding together before committing. In a pool, initially let the client select an eligible coach and available time; automatic round-robin routing is an additional scope proposal, not a confirmed capability.

For recurring bookings, preview every occurrence, conflict, credit allocation, and unpaid reservation. Fixed-term series stay within the agreed booking/entitlement limits; ongoing arrangements use a bounded rolling horizon, with its length to be reviewed. Preserve the intended local appointment time across daylight-saving changes. An exception edits one occurrence unless the user explicitly chooses a supported future-series change. Never confirm conflicting occurrences silently.

Proposed calendar scope: connect one Google account per coach, select conflict-check calendars and one appointment destination. Schedulefa.st owns coaching appointment changes; external events block availability. External edits to managed appointments create a reconciliation task rather than automatically changing contractual/credit terms. Exact supported fields and synchronization behavior require Q-04 validation.

Create or attach the correct Zoom/manual meeting details per appointment, and include them in confirmations/reminders. Track recurring meeting instances separately from the reusable meeting number for summary association. A meeting-link failure must show a visible pending/error state and responsible task; do not send a confirmation falsely claiming a link exists. Disconnect/reconnect and manual-link recovery must preserve appointment identity and avoid duplicates.

Evaluate paid coverage before delivery even if a future reservation was allowed. Proposed coach UI shows eligible / payment needed / operational issue without exposing amounts. Platform delivery/completion actions require coverage; meeting links already shared externally are not reliable payment enforcement. The software cannot guarantee that a coach will not conduct an off-platform call. Do not claim billing controls automatically disable an external Zoom room without validating that specific integration behavior.

Proposed unpaid-reservation automation evaluates each affected occurrence, not every installment or the entire series. At the cutoff, reconcile near-simultaneous payment before cancellation, notify configured recipients, update calendar/meeting state, and release the reservation without duplicate credit changes. A later payment does not silently reinstate a canceled slot; offer rebooking if still available. Manual handling remains available and still prohibits uncovered coaching delivery.

## 11. Cancellations, absence, expiration, and makeups

**Confirmed:** Businesses configure a notice cutoff, session-use consequences, and authorized exceptions. Eligible timely-canceled sessions can be made up after the original program end. Ordinary expiration and makeup eligibility are separate concepts. No universal 24-hour policy is confirmed. R-003–R-005; D-006–D-010.

**Proposed — P-11: cancellation model.** Snapshot the applicable agreement policy and credit cost onto each appointment. Show the consequence before a family confirms cancellation. Record the initiator, event time, notice calculation, policy outcome, and any exception with its reason and authorized actor. Staff canceling on behalf of a family must identify the actual reason; administrative action alone should not change the outcome.

| Event | Proposed supported treatment |
| --- | --- |
| Timely family cancellation | Release the reservation and preserve eligibility according to the agreed cancellation/makeup policy |
| Late cancellation or no-show | Apply the selected policy: preserve or forfeit the configured session-credit cost; funded/unfunded penalties need the Q-03 accounting review |
| Coach/business cancellation | Preserve the client's entitlement; arrange replacement/rescheduling without a student penalty |
| Reschedule | Release/replace the original hold together with booking the replacement; display whether the late-change rule applies |
| Ordinary unused-credit expiry | End ordinary booking eligibility according to the accepted period/policy; retain the event history |
| Eligible makeup | Keep a separately identifiable entitlement linked to its original purchase/session and deadline |
| Authorized exception | Explicitly record the replacement outcome; do not silently rewrite the business policy |

Define the exact cutoff boundary and timezone calculation in the accepted terms. Do not reset expiry on every reschedule or create a second credit when a preserved session is moved. A makeup after the original term remains bookable only under its permitted service/coach/funding/deadline rules; portal booking access should reflect that eligibility. Staff need a review task before closing an arrangement with outstanding eligible makeups.

Credit forfeiture is not an automatic cash charge. Cancellation, cash refunds, installment obligations, and future renewal are separate decisions. Already-completed sessions and their audit history must survive corrections. Proposed rules for unfunded forfeitures, refund shortfalls, pauses, and multiple reschedules need explicit Q-03 review.

## 12. Email and SMS notifications

**Confirmed:** Email notifications plus optional business-enabled SMS appointment reminders for recipients who opt in. Reminders must include the correct meeting details. D-047; R-001, R-030.

**Proposed — P-12: communication controls.** Configure permitted recipients by student, relationship, message type, and booking rights. Possessing an email/phone number or being the payer is not SMS opt-in or permission to receive all coaching content. Track channel preferences and SMS opt-in/opt-out separately for each verified recipient; provide supported preference controls before and after portal setup.

Recommended starting schedules for review: email appointment reminders 24 hours and 1 hour before; one SMS reminder 2 hours before when the business has enabled SMS and the recipient has opted in. Businesses can adjust the supported schedule. These values are proposals, not confirmed universal defaults. Confirmations and material appointment changes are separate events. Avoid sending an already-past reminder immediately after a last-minute booking unless the approved rule calls for it.

Proposed SMS content is limited to business identity, appointment time/timezone, and an authorized meeting/manage-booking link. Exclude coaching notes, summaries, homework details, balances, and payment amounts. Twilio is the SMS provider (D-052). Validate supported numbers, sender configuration (including A2P 10DLC registration), opt-out behavior, permitted content, and usage costs with Twilio and applicable requirements. No automatic overage billing is selected.

Recommended quiet-hour proposal: suppress SMS outside 8 a.m.–8 p.m. in the recipient's known timezone; otherwise use an explicitly disclosed business-timezone fallback. Continue the independently configured email route and surface suppression. Do not send a stale reminder after the session merely to clear a queue. Quiet-hour exceptions and final settings remain review items.

On reschedule, cancel obsolete scheduled reminders and calculate the new schedule from the current appointment version. On cancellation, suppress future reminders. Record queued, accepted by provider, delivered where reported, failed, and suppressed states without treating delivery as proof that a person read the message. Retry transient failures with duplicate protection; hard bounces/invalid numbers create an authorized staff task.

Maintain visible usage counters and warnings for cost-bearing channels. Proposed cap behavior pauses additional SMS at the approved allowance and uses permitted email notifications; it does not silently charge extra or cancel coaching. Exact quotas, resets, channel fallback preferences, consent handling, and pricing need Q-01/Q-04 review. SMS reminders do not add two-way messaging or SMS coaching-summary delivery.

## 13. Session notes and AI follow-ups

**Confirmed:** Automatically import an authorized Zoom meeting summary as the first integrated input. Manual notes and pasted/uploaded existing transcripts are fallbacks. Support manual approval and optional business-enabled automatic sending, with student/parent versions or a shared version. Homework remains coach-written. Capture settings, raw-content access, and publishing permission are separate. D-018, D-028, D-034–D-037.

**Proposed — P-13: follow-up lifecycle.** Match the available source to the correct business, meeting instance, appointment, and student. Keep the original source private to authorized staff. A missing, ambiguous, restricted, or failed import creates a visible task and manual fallback; it does not trigger invented session content or automatic forwarding of the raw source.

Proposed sequence: attended session recorded → source available/entered → permitted context selected → draft versions prepared → required checks/review → publish/send → per-recipient delivery record. State and timestamps distinguish source readiness, generation, approval, publication, and notification. An imported summary alone is not a published follow-up or a homework assignment.

Manual approval is the recommended initial default. Automatic sending requires explicit business configuration of eligible sessions, allowed sources/content, audiences, templates, and timing. A model error, uncertain recipient permission, missing required input, missing opt-in where relevant, or unavailable source should hold the affected version for staff resolution. A missed automation deadline creates a task; it does not authorize a lower-quality or more permissive fallback.

Private coach-only notes are excluded from family-directed automatic-generation context by default. Distinguish permission to use material for an audience-specific derived update from permission to read the raw transcript. Apply source eligibility and recipient controls before generation, and validate publication independently afterward; a prompt alone is not an access-control system. AI accuracy/privacy cannot be guaranteed solely by a format or template. Sample testing and the allowed content policy remain launch gates under Q-02/Q-04.

Student versions may focus on session-agreed next steps; parent versions may focus on permitted progress updates. Shared versions remain available. These are example templates, not universal content rules. Each guardian receives only the version permitted by their own access. Do not combine recipients in a visible email list by default. If guardian permissions differ and the existing version is unsuitable, hold or manually prepare a permitted version rather than widening access.

Proposed delivery default: publish the permitted version in the portal and send an email notification linking to it. Full-content email, guest follow-up access, timing, and resend/version rules require review. SMS does not carry the coaching summary. Repeated provider/source events must not send the same follow-up twice; a deliberate corrected version has its own history and approved recipient list.

Zoom's native summary is an input, not a selected provider for all audience-specific rewriting. Follow-up drafts use the OpenAI API (D-052). The specific model, processing terms, retained inputs, quality tests, limits, and costs are still to be selected. Recommend validating Zoom's host-only native sharing to avoid a second, unreviewed family recap; no Zoom setting has actually been changed. Prior public research is in product-plan section 13; live account feasibility remains untested.

## 14. Homework and shared files

**Confirmed:** Coaches write homework manually. The focused student portal includes homework, shared follow-ups, meeting links, authorized booking/rescheduling, and files. Dedicated goal dashboards, private journaling, and in-app messaging are outside launch. D-033, D-037.

**Proposed — P-14: simple assignment workflow.** An authorized coach creates a title, instructions, optional due date, linked session, and allowed student/guardian audience. Proposed states are draft → assigned → student reports complete → coach reviewed, with reopen/archive actions. Allow a short completion response; automated grading, AI task generation, and a separate progress dashboard are proposed exclusions. Follow-up text can reference an existing assignment or a session-agreed next step, but only an explicit coach action creates an assignment record.

Proposed launch file scope is coach-uploaded resources and homework attachments that authorized families can download. Student file uploads, shared document editing, and advanced submission workflows remain unconfirmed scope. Start with a small supported file-type/size list after storage/security validation; reject unsupported files clearly. A file is private until the uploader chooses permitted recipients, and its access must be checked when opened, not just when the link is created.

Define parent visibility and who may mark work complete independently of booking/payment permissions. Removing a guardian or coach grant should remove future portal access to affected files and drafts; it cannot recall content someone already downloaded or received by email. File retention and removal follow the reviewed data lifecycle, not an unlimited-storage promise.

## 15. SaaS plans, staff lifecycle, and business continuity

**Confirmed:** An ongoing limited free plan and paid staff-capacity tiers. Parent/student portal access alone does not consume staff capacity. Schedulefa.st adds no coaching transaction fee; external payment costs remain separate. A voluntary lower-capacity downgrade requires staff selection/reduction before activation and preserves records. D-042–D-044, D-048.

**Proposed — P-15: plan/counting model.** Count each active staff membership once, including owners/admins/coaches; an owner who also coaches uses one seat. Pending invitations reserve available capacity until accepted, revoked, or expired; explain that reservation separately from active staff. Inactive former staff retain attribution on records but cannot sign in to the workspace. Reactivation requires available capacity and renewed access checks. The example CEO + administrator + ten coaches needs twelve staff seats.

Keep staff capacity distinct from AI generation, SMS, e-signatures, files, and other cost-bearing allowances. Make plan/usage counters visible before a limit is reached. Proposed response to a usage cap is to pause the affected optional action, explain the cause, and offer an approved upgrade/purchase or manual route where supported. Do not silently charge overages. A signature limit can block a new signing request; it must not invalidate a signed agreement or remove an existing client's records.

The exact free/paid prices, seat caps, active-client/activity/storage allowances, included AI/SMS/signatures, reset periods, additional purchases, and card requirements remain Q-01. The marketing website's invented prices/capacities are historical candidates, not accepted entitlements or promises of unlimited usage. No SaaS billing provider is selected. Publish neither final pricing nor a release entitlement matrix until costs and limits have been reviewed.

**Proposed — P-16: implement the confirmed guided downgrade.** Show the target plan, effective date, affected staff, features/usage, future appointments, and unfinished tasks. The owner chooses who remains active. Prepare client/session ownership and unsent-work handovers, or resolve those appointments with affected families. Proposed activation blocks unresolved future appointments assigned to staff who will become inactive; it does not silently cancel them.

Apply the approved staff inactivation at or before the lower plan takes effect, and recheck capacity then. Preserve historical notes, authorship, payments, credit events, and client records under their permissions. Handing over a task does not grant the administrator private-note access. Show and confirm any loss of optional paid features, such as SMS or AI capacity; existing permitted records remain available under the reviewed access policy.

Recommended timing is the next paid renewal boundary, with a clear preview of charges and a way to cancel the pending change beforehand. If preparation is incomplete, do not activate the lower plan; explain the current-plan billing consequence before the owner schedules/confirms the change. Exact effective-date/proration and incomplete-request behavior need Q-01/Q-05 review. There is no selected post-activation staff-capacity grace period.

**Proposed — P-17: separate failed-payment and closure policies.** A failed SaaS subscription payment does not mean a family's coaching purchase is unpaid. Recommended review starting point: a seven-day SaaS recovery window with owner notifications, followed by restrictions on new enrollments/staff and new cost-bearing AI/SMS work. Preserve access to existing schedules, essential operational email reminders, manual coordination, and export during a bounded transition window, proposed as thirty days. Define the later read-only state and family-facing notices before approval. These durations and service levels are proposals, not confirmed entitlements.

Voluntary cancellation should offer a guided move to the free plan where eligible. Closing a business needs a checklist for outstanding coaching purchases, recurring charges, appointments, makeups, guardian communications, and exports. A SaaS subscription change must not silently refund/cancel the business's coaching contracts or erase its Stripe history. Conversely, continuing client charges without an understood service/transition plan is an unresolved lifecycle risk. The approved product must explain who manages or stops each payment arrangement and what happens when the workspace is unavailable. Q-05.

No automatic deletion date, indefinite free service, retention guarantee, or ongoing processing of every external subscription is established by this proposal. Ownership transfer, last-owner recovery, staff departure, and the platform support-access process must be resolved before launch.

## 16. Proposed screen and navigation map

**Proposed — P-18:** Use readable typography, clear status labels, restrained black/white surfaces, and accent colors for focus and meaningful states. Carry the schedulefa.st brand into the product; the existing marketing site remains a separate artifact. Design mobile-friendly family flows and keyboard-accessible staff flows, including empty, loading, error, permission-denied, and over-limit states.

| Surface | Screens / principal work | Permission-sensitive behavior |
| --- | --- | --- |
| Public business entry | Business booking profile; booking pages (free or paid) with questionnaire; inquiry form; confirmation/manage link | No portal signup required; no unrelated prospect/client data |
| Guest commercial flow | Offer selection; contract review/signing; checkout; pending/success/failure | Intended family's own documents/amounts; secure action-specific access |
| Staff onboarding | Business setup; invitations; calendar/Zoom/payment setup; service/policy preview | Owner/admin permissions; clear provider connection owner |
| Staff home | Today's sessions, assigned tasks, payment/booking issues, unsent follow-ups | Role/client/content filtering; coach sees no financial amounts |
| Inquiries | Queue, intake details, match coach, handoff, consultation outcome, offer action | Commercial actions and private fit notes separated |
| Clients | Directory; authorized student profile; family relationships; enrollment; sessions; shared work | Pricing/payment tab only for owner/admin; private content by grant |
| Calendar/bookings | Availability, recurring-series preview, appointment detail, cancel/reschedule | Credit/funding eligibility; explain series vs one-occurrence changes |
| Session workspace | Attendance, permitted notes/source, follow-up versions, manual homework | Author/audience separation; explicit sending mode and send state |
| Commercial workspace | Offerings, agreements, purchases, installments, adjustments/issues | Owner/admin; separate sensitive financial permissions |
| Team/settings | Staff, roles/grants, pools, policies, workflows, integrations, notification settings | Owner-governed changes; no arbitrary role/workflow builder |
| SaaS account | Plan, usage, invoices where supported, guided upgrade/downgrade, closure/export | Owner by proposed default; no accidental client-billing changes |
| Student portal | Home, book/manage sessions, join details, shared follow-ups, homework, files, settings | Only own permitted content; no journal, chat, or goal dashboard |
| Guardian portal | Authorized student selection, permitted booking/shared work, own commercial access | Each guardian's permissions checked separately; no sibling access by inference |
| Operational issue queue | Provider failures, stale sync, missing source, delivery failures, handover tasks | Route to responsible authorized staff; private payload not in generic alerts |

Wireframes and exact navigation labels remain review work. Each screen must make the next permitted action and the reason for a blocked action understandable without exposing implementation details to families.

## 17. Proposed conceptual records and states

**Proposed — P-19:** This is a product information model, not a database schema, technology choice, or migration. Keep these concepts distinct even where implementation later combines storage.

| Record | Purpose / important separation |
| --- | --- |
| Business/workspace | Business identity, timezone, settings, subscription and eligibility |
| Identity and staff membership | Login identity versus business-specific role, active state, permissions |
| Student/contact and relationship | Person versus student/guardian/payer/signer roles and authorized links |
| Client assignment/access grant | Who can see which client/content, why, and when that access ends |
| Inquiry and workflow task | Intake, referral source, current stage, responsible staff, next action |
| Offering/session type/pool | Reusable service terms, duration/credit cost, eligible coaches |
| Offer/contract/version | Proposed terms, accepted choice, signature requirements/status/evidence |
| Enrollment and purchase | Coaching relationship versus a specific fixed-term/monthly entitlement |
| Payment/payment schedule | Provider transaction and state, allocation to purchase/cycle, adjustments |
| Credit event/reservation | Funding, holds, usage, expiry, forfeiture, makeup and corrections |
| Appointment/series occurrence | Time, timezone, coach, service, outcome, eligibility, individual exceptions |
| Provider connection/remote reference | Authorized account/host, calendar/meeting/payment IDs, health and ownership |
| Private note/source material | Authored notes, imported summary/transcript, classification and access |
| Follow-up/version/publication | Audience-specific content, source eligibility, approval/send mode, recipients |
| Homework/status response | Coach-authored task, student status/response, allowed audience |
| Shared file | Owner, type/size, session/task link, sharing and retention state |
| Notification/delivery | Message purpose, appointment/content version, recipient/channel, delivery state |
| SaaS entitlement/usage/change | Staff/usage capacity, plan periods, pending change, downgrade preparation |
| Audit event/operational issue | Actor, action/reason, object/version, failure/recovery ownership |

Do not use a single generic “active” flag to mean paid, signed, enrolled, booked, attended, and portal-enabled. A scheduled appointment has independent attendance, funding, integration, and notification states. A successful payment event does not mean a reminder was delivered or a contract signed. A sent follow-up does not mean homework was assigned or read.

Record lifecycle transitions explicitly: appointment scheduled → attended/canceled/no-show; source pending → ready/unavailable; follow-up draft → approved/published with separate delivery states; membership invited → active/inactive. Proposed pending/error states must allow staff to recover without manufacturing success or repeating a charge/send.

## 18. Trust, reliability, and recovery requirements

**Proposed — P-20:** These requirements make the selected workflows operable. Their exact service levels, tooling, and retention periods require review. The technology stack is selected in D-050–D-052 (product plan section 15); no compliance certification is selected.

- Enforce business isolation, roles, client grants, pricing restrictions, content audiences, and session eligibility at the action/data boundary, including background jobs and exports. Hiding a navigation item is insufficient.
- Verify identity for staff/portal invitations and sensitive account changes. Use limited, expiring guest links and protected file access. Define session recovery, stronger owner authentication, ownership transfer, and support impersonation/access controls.
- Use current appointment/policy/payment state when a delayed job runs. Repeated/out-of-order provider events must not duplicate charges, credits, bookings, signatures, follow-ups, or reminders. Reconcile payment and cancellation races before irreversible delivery decisions.
- Prevent competing bookings from claiming the same slot or entitlement. Revalidate pool eligibility, staff active status, and content grants after reassignment or removal.
- When calendar availability is stale or a connection fails, show the issue and avoid treating an unknown slot as free. Provide a bounded recovery/manual coordination route instead of silently confirming a conflict.
- Keep a visible issue queue with an owner, safe retry, last status, and resolution history. A provider acknowledgment is not evidence of completed user-visible delivery. Scheduled retries stop after cancellation, revocation, replacement, or deletion.
- Protect credentials and coaching content; exclude private payloads from ordinary logs, metrics, analytics, and generic staff alerts. Provider disconnect must stop new authorized access and surface affected work.
- Define backup/restore expectations, record exports, deletion requests, contract/financial record treatment, file retention, and retention for raw summaries/transcripts separately. No “delete business” action should silently destroy records before its approved preview and retention rules apply.
- Investigate applicable requirements for target ages, guardian authority, recording/summary capture, privacy, provider processing, and client locations. Capture enablement, source viewing, model processing, and publishing are different permissions/choices. The U.S. launch boundary alone establishes no compliance conclusion.
- Validate keyboard navigation, readable contrast/type, meaningful errors, mobile forms, timezone displays, daylight-saving boundaries, and degraded provider states. Set measurable operational targets after representative load/provider testing, rather than inventing uptime or delivery guarantees.

Product support needs controlled account lookup, issue diagnosis, safe reprocessing, audit access, and permission-scoped exports. Private coaching-content support access should require an explicit approved process; an engineering support role is not another customer staff role or a blanket right to read student data.
