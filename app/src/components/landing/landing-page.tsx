import Link from 'next/link'
import { MARK_VIEWBOX, MarkPaths } from '@/components/brand'
import { SiteNav, WorkflowTabs, type FlowTab } from './interactive'
import { BookingPagePreview, BookingsPreview, ConfirmationPreview, PaymentsPreview, TeamPreview } from './product-previews'
import '@/app/landing.css'

// The marketing home page (from the landing/ design). Copy describes what is live today; anything still in
// development is labelled as coming next. Product images are the real screens (product-previews.tsx). Prices are planned, not charged (no billing is built yet).

function BrandMark({ className }: { className: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true">
      <MarkPaths />
    </svg>
  )
}

function Brand() {
  return (
    <a className="brand" href="#" aria-label="schedulefa.st home">
      <BrandMark className="brand-mark" />
      <span className="brand-wordmark">schedulefa.st</span>
    </a>
  )
}

const Icon = ({ id, className }: { id: string; className?: string }) => (
  <svg className={className}>
    <use href={`#${id}`} />
  </svg>
)

function SvgLibrary() {
  return (
    <svg className="svg-library" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <symbol id="arrow-up-right" viewBox="0 0 24 24"><path d="M5 19 19 5M5 5h14v14" /></symbol>
      <symbol id="arrow-right" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" /></symbol>
      <symbol id="check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></symbol>
      <symbol id="home" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10H3Zm6 10v-7h6v7" /></symbol>
      <symbol id="people" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v3" /></symbol>
      <symbol id="calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2" /></symbol>
      <symbol id="layers" viewBox="0 0 24 24"><path d="m3 7 9-4 9 4-9 4Zm0 5 9 4 9-4M3 17l9 4 9-4" /></symbol>
      <symbol id="sparkles" viewBox="0 0 24 24"><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6ZM20 2v4m-2-2h4" /></symbol>
      <symbol id="clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
      <symbol id="mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 6 9 7 9-7" /></symbol>
      <symbol id="video" viewBox="0 0 24 24"><rect x="3" y="6" width="12" height="12" rx="3" /><path d="m15 10 6-3v10l-6-3" /></symbol>
      <symbol id="card" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h4" /></symbol>
      <symbol id="link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1m2 4a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" /></symbol>
      <symbol id="chevron" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></symbol>
    </svg>
  )
}

const flows: FlowTab[] = [
  {
    id: 'flow-book',
    title: 'Share a booking page.',
    summary: 'Families see only the times you and your business are open, answer your questions, and pay by card when a call is paid.',
    panel: <BookingPagePreview />,
  },
  {
    id: 'flow-confirm',
    title: 'Every call, organized.',
    summary: 'A calendar event, a Zoom link, a confirmation and a reminder 24 hours before. Guests reschedule or cancel from their own link.',
    panel: <ConfirmationPreview />,
  },
  {
    id: 'flow-team',
    title: 'Your whole team, aligned.',
    summary: 'Owner, administrator and coach roles, and each coach’s free times. Shared booking pages send each call to a free coach, spread evenly.',
    panel: <TeamPreview />,
  },
]

interface Plan {
  id: string
  name: string
  icon: string
  description: string
  /** Monthly price in USD, or null for "contact us". */
  price: number | null
  unit?: string
  featured?: string
  seats: string
  includes: string[]
  cta: { label: string; href: string }
}

// Planned prices (D-067). Nothing is charged yet; billing isn't built.
const plans: Plan[] = [
  { id: 'solo', name: 'Solo', icon: 'home', description: 'Everything a solo coaching business needs.', price: 10, unit: '/ month', seats: 'Just you', includes: ['Booking pages & custom questions', 'Google Calendar & Zoom', 'Card payments & refunds', 'Email confirmations & reminders'], cta: { label: 'Start free', href: '/sign-up' } },
  { id: 'team', name: 'Team', icon: 'people', description: 'For coaching and tutoring teams of any size.', price: 15, unit: '/ person / month', featured: 'FOR GROWING TEAMS', seats: 'Priced per person on your team', includes: ['Everything in Solo', 'Owner, administrator & coach roles', 'Shared booking pages & fair assignment', 'Business hours & team free times'], cta: { label: 'Start free', href: '/sign-up' } },
  { id: 'corporate', name: 'Corporate', icon: 'layers', description: 'For larger organizations with many coaches.', price: null, seats: 'Pricing for your organization', includes: ['Everything in Team', 'Pricing for larger teams', 'Several businesses, one account', 'Help getting your team set up'], cta: { label: 'Contact us', href: '/contact?plan=corporate' } },
]

function PricingPlans() {
  return (
    <div className="pricing-grid">
      {plans.map((p) => (
        <article key={p.id} className={`price-card${p.featured ? ' featured' : ''}`}>
          {p.featured && <div className="plan-ribbon">{p.featured}</div>}
          <div className="plan-heading">
            <Icon id={p.icon} className="icon plan-icon" />
            <h3>{p.name}</h3>
          </div>
          <p className="plan-description">{p.description}</p>
          {p.price != null ? (
            <div className="price"><span>$</span><strong>{p.price}</strong><span>{p.unit}</span></div>
          ) : (
            <div className="price price-custom"><strong>Let’s talk</strong></div>
          )}
          <p className="billing-note">{p.price != null ? 'Planned price · not charged today' : 'Tell us about your organization'}</p>
          <Link className={`button price-button${p.featured ? '' : ' button-outline'}`} href={p.cta.href}>
            {p.cta.label} <Icon id="arrow-up-right" className="icon" />
          </Link>
          <div className="plan-includes">
            <b>{p.seats}</b>
            <ul>{p.includes.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </article>
      ))}
    </div>
  )
}

const faqs: [string, string][] = [
  ['Can I use schedulefa.st today?', 'Yes. Create your business for free, set your hours and share a booking page in a few minutes. Families can book free or paid calls right away.'],
  ['Do families need an account?', 'No. They book with their name and email, answer any questions you add, and get a private link to reschedule or cancel.'],
  ['Does it work with Google Calendar and Zoom?', 'Yes. Both connect to your own accounts: busy times on Google Calendar keep you from being double-booked, each booking is added to your calendar, and Zoom pages create a meeting for every booking. Both connections are opening to everyone as Google and Zoom finish reviewing our app; until then, any booking page can use your own meeting link.'],
  ['Is it for solo coaches or teams?', 'Both. Invite coaches and administrators, set business hours, and share a booking page across a group of coaches. If you work for more than one business, one account covers all of them, without double-booking.'],
  ['How do payments work?', 'Connect your own Stripe account and set a price on any booking page. Families pay by card when they book, the money goes to you, and refunds follow the cutoff you choose. schedulefa.st takes no fee on your coaching payments; Stripe’s standard processing fees apply.'],
  ['What’s coming next?', 'Client records with packages and session credits, then intake, offers and e-signing, family portals, and AI-assisted follow-ups. Booking is the foundation the rest builds on.'],
]

export function LandingPage() {
  return (
    <div className="lp">
      <a className="skip-link" href="#main">Skip to content</a>
      <SvgLibrary />

      <header className="site-header">
        <div className="nav-wrap lp-container">
          <Brand />
          <SiteNav />
        </div>
      </header>

      <main id="main">
        <section className="hero lp-container">
          <div className="eyebrow"><span className="status-dot"></span> YOUR COACHING BUSINESS. ON THE FAST TRACK.</div>
          <h1>Streamline your entire<br /> <span>coaching business.</span></h1>
          <p className="hero-copy">Give families one link to book, pay and join the call. schedulefa.st keeps your calendar, Zoom links, payments and reminders in step, for solo coaches and growing teams.</p>
          <div className="hero-actions">
            <Link className="button" href="/sign-up">Create your business <Icon id="arrow-up-right" className="icon" /></Link>
            <a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">→</span></a>
          </div>
          <p className="hero-note">Free to start.<span>No credit card required · Families book without an account</span></p>

          <div className="product-scene">
            <BookingsPreview />
          </div>
          <p className="preview-caption">The real schedulefa.st app, shown with sample data.</p>
          <div className="coverage-strip" aria-label="What schedulefa.st does today"><span>Booking pages</span><span>Google Calendar</span><span>Zoom links</span><span>Stripe payments</span><span>Email reminders</span><span>Teams</span></div>
        </section>

        <section className="intro-section lp-container" id="platform">
          <div className="section-kicker">WHAT YOU CAN DO TODAY</div>
          <div className="intro-grid">
            <h2>Get booked, paid and reminded.<br />Automatically.</h2>
            <div>
              <p>Share one link. Families pick a time inside your hours, answer your questions, and pay if the call is paid, all without creating an account.</p>
              <p>schedulefa.st keeps your calendar, meeting links and reminders in step, whether you coach on your own or run a team.</p>
            </div>
          </div>
          <div className="benefit-row">
            <div><span className="benefit-number">01</span><h3>Booking pages your way</h3><p>Free or paid calls, your own questions, buffers, minimum notice and a booking window. One coach, or any available coach from a group.</p></div>
            <div><span className="benefit-number">02</span><h3>Calendars and links, handled</h3><p>Busy times on Google Calendar block bookings, each booking lands on your calendar, and Zoom pages get their own meeting link.</p></div>
            <div><span className="benefit-number">03</span><h3>Built for teams</h3><p>Invite coaches and administrators, set business hours, and let people who work for several businesses use one account.</p></div>
          </div>
        </section>

        <section className="workflow-section" id="how-it-works">
          <div className="lp-container">
            <div className="workflow-heading">
              <div><div className="section-kicker">FROM LINK TO FINISHED CALL</div><h2>Every booking<br />moves on its own.</h2></div>
              <p>Confirmed, on the calendar, paid and reminded, and easy for families to change when plans do.</p>
            </div>
            <WorkflowTabs tabs={flows} />
          </div>
        </section>

        <section className="details-section lp-container">
          <article className="detail-block">
            <div className="section-kicker">PAYMENTS WITH STRIPE</div>
            <h2>Get paid<br />when they book.</h2>
            <p>Set a price on any booking page and families pay by card when they book, straight to your own Stripe account. Refunds follow the cutoff you choose, and if you cancel, they’re refunded in full.</p>
            <div className="detail-preview"><PaymentsPreview /></div>
          </article>
          <article className="detail-block settings-block">
            <div className="section-kicker">COMING NEXT</div>
            <h2>The rest of your<br />business, next.</h2>
            <p>Booking is the first step. We’re building out the rest of the client journey, one piece at a time.</p>
            <div className="settings-demo">
              <div className="settings-title"><Icon id="layers" /><b>On the roadmap</b><span>In development</span></div>
              <div><span>Client records, packages & session credits</span><b>Next</b></div>
              <div><span>Intake, offers & e-signing</span><b>Planned</b></div>
              <div><span>Family portals</span><b>Planned</b></div>
              <div><span>AI-assisted follow-ups</span><b>Planned</b></div>
              <div className="settings-note"><Icon id="check" /> Live today: booking pages, calendars, Zoom, payments, reminders and teams.</div>
            </div>
          </article>
        </section>

        <section className="pricing-section" id="pricing">
          <div className="lp-container">
            <div className="pricing-heading">
              <div className="section-kicker">SIMPLE PRICING</div>
              <h2>Start free.<br />Grow with your team.</h2>
              <p>Create your business and take bookings for free today.<br />Paid plans are on the way: one price for solo coaches, per person for teams.</p>
            </div>
            <PricingPlans />
            <p className="pricing-footnote">Paid plans aren’t live yet. These are planned prices in USD and may change; nothing is charged today.<br />schedulefa.st takes no fee on your coaching payments. Stripe’s standard processing fees apply.</p>
          </div>
        </section>

        <section className="faq-section lp-container" id="questions">
          <div><div className="section-kicker">FREQUENTLY ASKED QUESTIONS</div><h2>Your questions,<br />answered.</h2><p>What schedulefa.st does today, and what’s next.</p></div>
          <div className="faq-list">
            {faqs.map(([q, a]) => (
              <details key={q}><summary>{q}<Icon id="chevron" /></summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="final-cta lp-container">
          <BrandMark className="cta-mark" />
          <div className="section-kicker">BUILT FOR THE BUSINESS BEHIND YOUR COACHING</div>
          <h2>Your first booking page,<br />live today.</h2>
          <p>Create your business, set your hours and share your link. It’s free to start.</p>
          <Link className="button button-lime" href="/sign-up">Create your business <Icon id="arrow-up-right" className="icon" /></Link>
          <span className="cta-note">Free to start · No credit card required · <Link href="/sign-in">Sign in</Link></span>
        </section>
      </main>

      <footer className="site-footer lp-container">
        <div><Brand /><p>Schedule faster. Run your business smarter.</p></div>
        <div className="footer-links">
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#questions">Questions</a>
          <Link href="/contact?plan=other">Contact</Link>
          <Link href="/sign-in">Sign in</Link>
        </div>
        <div className="footer-bottom">
          <span>© 2026 schedulefa.st</span>
          <span><Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Service</Link></span>
          <a href="#">Back to top ↑</a>
        </div>
      </footer>
    </div>
  )
}
