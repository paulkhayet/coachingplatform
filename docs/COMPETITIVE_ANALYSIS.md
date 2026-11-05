# schedulefa.st — Competitive and Business Analysis

Research date: November 5, 2026  
Status: Research and recommendations; launch audience, pricing, and release scope require founder decisions.  
Related source of truth: [Product plan](PRODUCT_PLAN.md)

## 1. Business assessment

**The opportunity worth testing is a simpler, more dependable way to run a particular kind of coaching business. An all-in-one coaching platform is already an established category.** The current feature list does not establish a unique product.

My recommended initial customer is a coaching business with roughly 3–20 coaches, an owner or administrator coordinating operations, prepaid coaching packages, and clients whose payer or coordinator may be someone other than the person receiving coaching. Student and executive-function coaching businesses with parent involvement are a promising starting hypothesis because we have access to that workflow. This is a proposed sales focus, not a restriction on the platform's configurable capabilities.

The potential advantage is the complete experience: move an inquiry through staff handoffs, get an agreement paid, establish the right client access, manage a shared coaching allowance, and deliver the right reminders and reviewed follow-ups. Every link must work with fewer manual interventions than the customer's best available alternative.

That advantage remains unproven. Several competitors already overlap substantially with this experience. Before application coding, we should test their actual workflows and find customers who can explain why those products fail their needs. If existing software solves the problem well, we should change our proposed differentiation rather than build a duplicate.

## 2. Evidence and limitations

This is desk research using official vendor pricing, product, and help pages. It establishes advertised capabilities and published prices, not independently tested usability, reliability, market share, or customer satisfaction. No competitor trial accounts were created and no demos or customer interviews were conducted.

Prices are snapshots, not quotes. The table distinguishes monthly subscriptions from annual billing and flags unresolved calculator behavior. Taxes, processing, messaging, recording, and other usage charges can change the total. Detailed session-policy compatibility remains a live-demo question even when a vendor advertises packages or cancellations.

“Needs verification” means the evidence does not settle the question. It does not mean a competitor lacks the feature. Strategic judgments and numerical scenarios below are our analysis, not vendor claims or market forecasts.

## 3. Closest competitors

| Company | Verified public offer and pricing | Implication for schedulefa.st |
| --- | --- | --- |
| **Delenta** | Solo plans list $29/$49/$79 monthly. Teams require a quote and use seat licensing; the advertised team offer includes roles, multi-coach assignment, automation, and operational reporting. [Pricing](https://www.delenta.com/pricing). Its team product also advertises coach matching, self-booking, and subscription/session tracking. [Team product](https://www.delenta.com/multicoach). | One of the closest direct rivals. We need a measured advantage in setup, daily administration, or a specific customer workflow. Generic team management is insufficient differentiation. |
| **CoachAccountable** | Active-client pricing: $70/month for 10, $120 for 20, $250 for 50, and $400 for 100; unlimited coach and administrator accounts are included. [Pricing](https://www.coachaccountable.com/pricing). Multiple coaches can work with the same client. [Team Edition](https://www.coachaccountable.com/teamEdition). | A strong benchmark for both coaching delivery and team economics. Charging fewer staff-seat fees alone does not distinguish us. |
| **Simply.Coach** | Business plans advertise coach matching, program-manager/sponsor roles, and access controls. Its calculator displays $79/$159/$289 with one active coach selected; the extracted annual/monthly presentation does not establish an unambiguous billing term or additional-coach formula. Obtain a comparable quote. [Business pricing](https://simply.coach/pricing-for-businesses/). | A direct team competitor, including businesses with multiple stakeholders. We must demonstrate a better fit for our chosen segment, rather than assume other products serve only individual coaches. |
| **Paperbell** | $97/month or $970/year; packages, scheduling, contracts, payments, and client workflows. [Pricing](https://paperbell.com/pricing/). Its help page explicitly says it does not support multiple coaches, logins, or additional admins within one account. [Multiple-user policy](https://paperbell.com/support/knowledge-base/multiple-users-logins/). | Strong solo-business overlap. A shared team workspace is a substantiated difference against this particular product, although not against the category as a whole. |
| **CoachVantage** | Clarity is $39/month and Aha $59/month on monthly billing. Scheduling, client portals, goals/assignments, contracts, and invoicing are listed; some quotas differ by plan. [Pricing](https://www.coachvantage.com/pricing). | A close comparison for the proposed $39 Solo plan. We cannot justify the product through a lower price than all coaching-specific alternatives. |
| **TutorBird** | $16.95/month plus $4.95 for each additional tutor or staff member, with unlimited students. [Pricing](https://www.tutorbird.com/pricing/). Family self-booking, configurable cancellation/makeup policies, and homework are advertised. [Portal](https://www.tutorbird.com/student-portal/). Individual staff access and permissions are also advertised. [Multi-tutor features](https://www.tutorbird.com/multi-tutor/). | A serious competitor if we start with student coaching. Parent/student support, makeups, and team permissions are not empty market gaps. Buyers may accept a tutoring-oriented product if it handles their operations well. |
| **TutorCruncher** | US plans start at $30/$80/$240 monthly. Standard card fees are listed at 3.85%/3.5% for the first two tiers; non-integrated payments can also incur platform charges. [US pricing](https://tutorcruncher.com/pricing/us). Its CRM advertises a client pipeline, distinct tutor/client/student profiles, and client-manager assignment. [Client management](https://tutorcruncher.com/features/tutor-client-student-management). | Another substantial competitor for administrator-led student-service teams. Compare the complete workflow and total fees rather than its starting subscription alone. |
| **Calendly and the existing tool stack** | Standard is displayed at $10/seat/month and Teams at $16 on annual billing, with AI notetaking available through additional plan options. [Pricing](https://calendly.com/pricing). Calendly also advertises prepaid meeting packages, payment links, and invoices. [Payments](https://calendly.com/payments). | The replacement decision includes keeping familiar tools. Scheduling, payment bundles, and AI recaps do not by themselves create a compelling reason to migrate. |

This shortlist prioritizes operational overlap with our plan. It is not an exhaustive directory of course platforms, wellness-practice software, CRMs, or every scheduling product.

### A particularly relevant family-workflow finding

CoachAccountable's published student-coaching guide already covers parents paying, signing agreements, and receiving restricted visibility. It models families through its Companies feature. The guide, published in 2022, describes group-based arrangements or forwarding for some joint notifications. [Working with Students](https://blog.coachaccountable.com/2022/10/working-with-students/).

This suggests a useful usability test: can we make parent/student relationships and communications substantially easier to understand and configure? It does **not** prove that the current product cannot meet the need. Confirm the current behavior in a demo, including whether anything has changed since that guide.

## 4. What will and will not distinguish the product

| Candidate selling point | Assessment |
| --- | --- |
| Scheduling, calendar sync, video links, reminders | Required foundation. Already widely advertised by this competitor set. |
| Packages, contracts, recurring payments, client portals | Established category functionality. Necessary, but not a sufficient reason to switch. |
| Teams, permissions, coach matching, multiple coaches per client | Important to our product; already offered by direct rivals. |
| Parents, students, homework, cancellations, makeups | Important segment requirements; adjacent education products already address them. |
| AI-generated summaries | Useful, readily comparable functionality. The valuable part is a correct, reviewed communication reaching the intended people with the intended content. |
| A more readable interface | Can improve activation and daily efficiency, but must be demonstrated through task completion. A polished landing page is not evidence of a better application. |
| Full enrollment-to-delivery workflow with fewer manual steps | Strongest hypothesis. Requires timed comparisons against competitors and the customer's existing process. |
| Shared allowances with clear payment coverage, split formats, and exception handling | Potentially valuable operational depth. Exact comparative behavior remains unverified; do not advertise it as unique yet. |

The best possible differentiation may be execution across several existing capabilities. Buyers do not need a wholly new feature if we solve their costly workflow more effectively and make switching worthwhile.

## 5. Recommended initial customer and positioning

### Proposed ideal customer

- Approximately 3–20 coaches under one business, with an owner or administrator responsible for enrollment and scheduling.
- Sells prepaid packages or monthly allowances and already uses several tools or manual records to coordinate delivery.
- Frequently coordinates a payer, coaching participant, and coach as separate people.
- Has measurable time spent on handoffs, scheduling changes, session balances, reminders, or follow-ups.
- Has sufficient ongoing activity and budget to pay for operational improvements.

Student and executive-function coaching teams are the first segment I would investigate. Keep the product configurable so the same underlying capabilities can later serve adult coaching businesses and other small teams. A focused launch audience need not mean practice-specific rules.

Interview solo coaches too, particularly those building a team. However, prioritize owner/admin-led team pain when testing our strongest business hypothesis. A company may have a bigger operational problem than an individual coach, but that does not automatically mean it will buy or be cheaper to acquire.

Current paid-before-coaching requirements may reduce fit for businesses that primarily invoice corporate clients after delivery. Preserve the agreed rule while investigating how frequently that limitation excludes otherwise attractive prospects. Any change requires a separate product decision.

### Proposed positioning to test

> schedulefa.st helps coaching businesses move clients from first inquiry to paid sessions and consistent follow-up, with less administrative work across the team.

For a segment-specific campaign, test an explicit parent/student variant. Avoid promising savings or superiority before measuring them.

The domain is memorable, but may lead visitors to expect a scheduler. Pair the brand with language that clearly communicates coaching-business operations. “All-in-one” can describe the scope; it will not establish a competitive advantage on its own.

## 6. How we could win

### A. Make staff handoffs dependable

An administrator should know which inquiries need matching, which coach owes a first-call outcome, and which family needs an offer. Coaches should see the next coaching task without needing access to prices. A solo owner should complete the same journey without unnecessary team ceremony.

Proposed proof: fewer manual messages and less administrative time from inquiry to paid enrollment, with every next action assigned. Investigate whether customers actually lose inquiries at handoffs before making this the primary promise.

### B. Make allowances understandable and trustworthy

Represent purchased coaching, reserved appointments, delivered sessions, paid coverage, forfeitures, preserved makeups, and authorized adjustments clearly. Support the agreed cross-coach allowance and configurable session formats without silently confusing appointment count with coaching time.

An administrator should be able to explain any remaining balance to a family. A coach needs an accurate eligibility indication without seeing prices. This is part of the proposed experience, not a claim that competitors lack session tracking.

Before implementation, resolve installment coverage, advance reservations, concurrent bookings, cancellation boundaries, and makeup expiry. These are both planning gaps and the places where a superficially complete product can fail customers.

### C. Make multi-person communication easy to control

Treat the coaching participant, payer, signer, booking coordinator, and communication recipients as distinct relationships. Make the destination and shared content clear before sending a follow-up. Keep private session material separate from a parent-facing update.

Test multiple children, multiple guardians, adult students, and changes in authorized access. These are research scenarios; their exact supported behavior is not yet agreed. AI should assist drafting and homework preparation within the chosen review process, rather than substitute for recipient/access decisions.

### D. Make onboarding and migration part of the product

Switching requires more than importing names. A viable migration plan must reconcile existing agreements, remaining session balances, preserved makeups, future bookings, team assignments, and client communications. Start with assisted, bounded migration rather than an open-ended promise to import everything automatically.

Measure setup effort and the time to the first successful paid booking. Provide clear exports and ownership of records. Incumbents also offer onboarding/import services, so our advantage would have to be a better migration experience for the target customer.

### E. Prove an operational outcome

Candidate success measures are administrative minutes per delivered session, inquiry-to-payment completion, time from session to approved follow-up, scheduling interventions, and balance corrections. Track missed or duplicate reminders as well as time saved.

Establish a baseline in the customer's current system. Choose one primary measure based on interviews. A proposed target such as cutting measured administrative time by 50% is a product experiment, not a current marketing claim.

## 7. Competitive demonstration script

Run the same scenario through current competitors, the existing tool stack, and eventually our prototype. Start with Delenta, CoachAccountable, and TutorBird; add Simply.Coach and TutorCruncher for target businesses where relevant.

| Test | What must be established |
| --- | --- |
| Guest inquiry | Parent submits information without creating a portal account. |
| Administrator matching | Admin selects a coach; ownership and the next task are clear. |
| First call and handoff | Coach records a fit outcome; admin resumes the commercial process without re-entering information. |
| Commercial permissions | Only authorized owner/admin staff see client prices, including in shared documents and communications. |
| Enrollment | Family accepts the relevant terms, pays, then receives the correct portal invitations. |
| Installments | A specified payment provides explicit session coverage; incomplete payment cannot authorize unpaid delivery. Test reservation behavior separately after we define it. |
| Shared allowance | A ten-session purchase can be used with ten eligible coaches without resetting or duplicating the balance. |
| Split formats | Where permitted, two 30-minute appointments consume the equivalent purchased 60 minutes. |
| Cancellation and makeup | Configured timely cancellation preserves eligibility; the preserved session can be used after the original end date under the agreed policy. |
| Communications | Correct meeting links follow reschedules; reminders and approved summaries reach the configured recipients. |
| Sensitive content | A parent-facing update can omit private content; coach-pool eligibility does not automatically expose the whole record. |
| Staff departure and failures | Remaining bookings, balances, permissions, and unsent tasks have an owner; failed sends or disconnected integrations are visible. |

For each product record: **native configuration / workaround / confirmed unsupported / not established**, plus setup time, manual steps, family friction, screenshots or documentation, plan required, and total cost. Mark unsupported only after direct verification. Some tests expose decisions we must settle in our own plan before scoring.

## 8. Pricing and unit economics

### Assessment of the current landing-page prices

The website proposes Solo $39/month for one owner-coach, Studio $99 for up to five staff, and Practice $199 for up to fifteen staff. These were creative launch-price drafts, not validated willingness to pay or confirmed product-plan pricing. The annual discounts are also unvalidated.

The solo price is within the range of researched coaching products. Team pricing may be attractive for some buyers, but it is not universally cheapest. We should sell measured operational value rather than promise to undercut the entire market.

Illustration for the previously discussed CEO + administrator + ten-coach business:

| Software | Published subscription calculation | Limits of comparison |
| --- | --- | --- |
| schedulefa.st draft | $199/month, within the proposed 15-staff tier | Product not built; AI/usage limits and final packaging undecided. |
| TutorBird | $16.95 + 11 × $4.95 = **$71.40/month** | Published staff formula; actual coaching-workflow fit still needs testing. [Source](https://www.tutorbird.com/pricing/). |
| CoachAccountable | **$250/month at 50 active clients; $400 at 100** | Staff count does not determine this price. Actual billable-client composition and workflow fit matter. [Source](https://www.coachaccountable.com/pricing). |
| Calendly Teams | **$160/month equivalent for ten host seats**, billed annually | Only a scheduling-plan comparison, not a complete twelve-person coaching operation; AI, other tools, and required extra seats are excluded. [Source](https://calendly.com/pricing). |

At the draft $199 price, the subscription difference from the TutorBird example is $127.60 monthly. If the buyer values administrative time at an assumed $30/hour, that is about 4.3 additional hours saved per month to cover the subscription difference. This is arithmetic, not evidence that we deliver those savings, and excludes other cost differences.

### Pricing recommendations to test

- Keep $39/$99/$199 as test prices until interviews, competitive demos, and a cost model justify a decision. Do not lower them simply because a cheaper product exists.
- Compare a simple workspace price with a base-plus-active-coach model. Consider including a small number of administrative accounts so pricing does not discourage proper staff separation. This is a packaging proposal, not an agreed entitlement.
- Keep family access easy to adopt; test including client/parent accounts rather than charging each family for a login.
- Define AI/transcription, storage, messaging, and support allowances before offering unlimited usage. Distinguish processing an existing transcript from recording/transcribing an entire session.
- Determine assisted-migration limits and onboarding cost. A setup fee or a bounded included service may be more sustainable than unlimited implementation support.
- Model platform subscription revenue separately from client payment volume. Processing or platform fees must be explicit if introduced; their inclusion is still open in the product plan.

### Cost and scale scenarios — assumptions, not forecasts

A hypothetical ten-coach business holding 60 one-hour sessions per coach monthly produces 600 session-hours, or 36,000 transcription minutes. At $199/month, subscription revenue is about $0.0055 per session minute before any costs. This does not establish an AI provider's price; it demonstrates why usage and support must be modeled.

If we choose an illustrative 80% gross-margin target, a $199 account allows $39.80/month in direct service costs under that definition. Record actual provider usage, storage, transactional communications, and attributable support/onboarding costs, and state which costs are included. Compare lifetime onboarding costs with expected retention, rather than ignoring setup work.

For scale perspective, 500 businesses at an average $199/month produce **$1.194 million in annualized subscription revenue**, before churn, discounts, taxes, costs, or salaries. This is a scenario, not an estimate of obtainable demand. A market-size estimate requires counting reachable qualifying businesses and validating what they pay; coaching-industry service revenue is not the software market.

Track acquisition cost per activated paying business, onboarding labor, gross contribution, retention, expansion, and time to recover acquisition cost. Avoid strong lifetime-value claims until actual retention cohorts exist.

## 9. Go-to-market recommendation

1. **Find design partners through relevant relationships and communities.** Investigate student/executive-function coaching business owners and administrators first. One familiar practice provides access and insight, not proof of a repeatable market.
2. **Sell to the owner with the administrator as an operational champion.** Observe coaches and families too: their adoption determines whether the purchase succeeds. Ask for a walkthrough of a recent real enrollment, reschedule, makeup, and follow-up before showing a feature pitch.
3. **Lead with the highest-cost workflow we can prove.** A segment-specific demonstration will be more informative than a broad promise to replace every tool. Do not manufacture customer quotes or outcome statistics for the landing page.
4. **Make the first customers successful through bounded assistance.** Document configuration and migration so each onboarding teaches us how to reduce the next one's effort. Do not accept unrelated bespoke requirements for every prospect.
5. **Build distribution from proof.** With customer permission, publish measured before/after stories and practical workflow guides. Explore partnerships with coaching-business educators and relevant associations after establishing fit. Treat broad paid search as an experiment with a strict acquisition-cost budget, not the initial growth assumption.

For the waitlist, useful future qualification fields would be business type, staff count, current tools, and the most expensive manual workflow. An email signup alone is weak evidence of purchase intent. These form changes are recommendations, not changes made by this analysis.

## 10. Thirty-day validation plan before application coding

The following are proposed decision thresholds, not established industry benchmarks or promised delivery dates.

| Period | Work | Evidence needed |
| --- | --- | --- |
| Week 1 | Run competitive walkthroughs and finalize the common demonstration script. | Understand what existing products solve, the remaining workarounds, and comparable total costs. |
| Weeks 1–2 | Interview 15–20 target businesses; observe at least 8–10 owner/admin workflow walkthroughs. Include current competitor users, not only people using spreadsheets. | Repeated pain, baseline time/cost, buyer identity, current spend, reasons existing tools were rejected, and willingness to migrate. |
| Week 3 | Show storyboards or a clickable prototype of the full candidate workflow, including exceptions and role-specific views. | Users complete realistic tasks; the proposed experience solves the observed problem with fewer interventions. No application build is required for this stage. |
| Week 4 | Test an explicit package, price, migration offer, and pilot commitment. | At least three independent businesses willing to enter a paid pilot when available, with a named buyer, real price, and agreed success criteria. No money needs to be collected merely to conduct this research. |

Proceed toward implementation planning if several independent businesses share a costly unmet problem, the proposed workflow materially improves it, and at least three credible buyers make a concrete pilot commitment. A paid pilot, when the product can actually support it, is stronger evidence than a nonbinding expression of interest.

Reconsider the scope or audience if competing products solve the workflow well, buyers will not switch, or the strongest requests are incompatible one-off customizations. If interest is mostly in a standalone administrative workflow, investigate a narrower product entry point instead of assuming a full replacement is required. That would be a new scope decision.

## 11. Strengths, weaknesses, opportunities, and threats

| Area | Assessment |
| --- | --- |
| Strengths | Direct access to a real workflow; early attention to teams, configurable policies, and staff handoffs; ability to design the complete experience coherently. |
| Weaknesses | No working application or demonstrated workflow advantage; unvalidated acquisition channels, pricing, and service costs; broad feature scope with important policy decisions unresolved. |
| Opportunities | A reachable segment may value simpler enrollment, clearer allowances, and better multi-person coordination enough to switch and pay. Assisted migration and focused templates can support adoption. |
| Threats | Direct rivals already cover much of the scope; low-priced education tools challenge economics; familiar tools continue expanding; migration and multi-user adoption can outweigh feature improvements. |

No durable competitive protection has been established. Features and interface patterns can be copied. Over time, reliable operations, useful domain-specific configuration, efficient onboarding, and trusted distribution could create an advantage. Customer data should remain exportable; trapping customers is not the proposed retention strategy.

## 12. Implications for the product plan

These are recommendations awaiting agreement:

1. Choose a specific launch customer while keeping reusable, configurable product capabilities.
2. Prioritize one complete enrollment-to-paid-delivery journey, including team and solo operation, before adding broad course, community, marketplace, or enterprise capabilities.
3. Resolve the allowance/payment, family-access, and transcript decisions already marked open in the product plan. These directly affect the proposed differentiation and cost model.
4. Add migration, onboarding effort, communication reliability, and measurable customer outcomes to release acceptance criteria.
5. Validate pricing and usage packaging with real buyer commitments.
6. Make no public claims that competitors lack a capability until the current product has been checked directly.

**Recommended immediate next action:** benchmark Delenta, CoachAccountable, and TutorBird against the exact workflow above, while interviewing business owners who already use them. The next product-planning discussion should use that evidence to decide whom we will serve first and what they will choose schedulefa.st to do better.
