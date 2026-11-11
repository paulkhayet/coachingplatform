import Link from 'next/link'
import { MARK_VIEWBOX, MarkPaths } from '@/components/brand'
import { PricingPlans, SiteNav, WorkflowTabs, type FlowTab, type Plan } from './interactive'
import '@/app/landing.css'

// The marketing home page (from the landing/ design). Copy describes what is live today; anything still in
// development is labelled as coming next. Prices are planned, not charged (no billing is built yet).

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
    id: 'welcome',
    title: 'Share a booking page.',
    summary: 'Families see only the times you and your business are open, answer your questions, and pay by card when a call is paid.',
    panel: (
      <>
        <div className="mini-label"><Icon id="link" /> BOOKING PAGE <span>Illustrative example</span></div>
        <div className="inquiry-card">
          <div className="inquiry-top">
            <span className="avatar avatar-peach">JL</span>
            <span><b>Jamie Lee</b><small>Booking a free intro call · 30 minutes · Zoom</small></span>
            <span className="new-tag">New booking</span>
          </div>
          <div className="intake-answer"><small>WHICH SUBJECT DO YOU NEED HELP WITH?</small><p>Math. Building confidence before the next unit test.</p></div>
          <div className="inquiry-source"><span>schedulefa.st/b/willow-coaching</span><span>Thu, Nov 5 · 10:00 AM</span></div>
        </div>
        <div className="flow-connector" aria-hidden="true"></div>
        <div className="matching-card">
          <span className="match-icon"><Icon id="check" /></span>
          <div><b>Booked. Confirmation sent.</b><small>Calendar invitation and Zoom link included</small></div>
          <span className="avatar avatar-sage">AM</span>
        </div>
        <div className="mini-progress"><span className="complete">Pick a time</span><i></i><span className="complete">Your details</span><i></i><span className="current">Confirmed</span></div>
        <p className="visual-footnote">No account needed to book.</p>
      </>
    ),
  },
  {
    id: 'sessions',
    title: 'Every call, organized.',
    summary: 'A calendar event, a Zoom link, a confirmation and a reminder 24 hours before. Guests reschedule or cancel from their own link.',
    panel: (
      <>
        <div className="mini-label"><Icon id="calendar" /> CALENDAR & REMINDERS <span>Illustrative example</span></div>
        <div className="session-demo">
          <span className="session-demo-date">THURSDAY <strong>05</strong> NOVEMBER</span>
          <div><span className="soft-tag">Tutoring session</span><h3>Your next call.<br />Already organized.</h3><p>Noah & Alex · 60 minutes · Paid $45</p></div>
        </div>
        <div className="handled-row"><Icon id="check" /><span>On Google Calendar</span><Icon id="check" /><span>Zoom link ready</span></div>
        <div className="matching-card">
          <span className="match-icon"><Icon id="mail" /></span>
          <div><b>The reminder, on its way.</b><small>Emailed to the guest 24 hours before the call</small></div>
        </div>
        <div className="draft-strip"><Icon id="clock" /><span>Need to move it? Guests reschedule or cancel from their link, and refunds follow your cutoff.</span></div>
      </>
    ),
  },
  {
    id: 'team',
    title: 'Your whole team, aligned.',
    summary: 'Owner, administrator and coach roles. Shared booking pages send each call to a free coach, spread evenly.',
    panel: (
      <>
        <div className="mini-label"><Icon id="people" /> TEAM <span>Illustrative example</span></div>
        <div className="team-demo-heading"><h3>One team. One workspace.</h3><p>Clear roles, everyone's own hours, fair assignment.</p></div>
        <div className="team-person"><span className="avatar avatar-sage">JL</span><span><b>Jordan Lee</b><small>Business hours, team & payments</small></span><span className="role-tag">Owner</span></div>
        <div className="team-person"><span className="avatar avatar-peach">MP</span><span><b>Maya Patel</b><small>Booking pages & every booking</small></span><span className="role-tag">Administrator</span></div>
        <div className="team-person"><span className="avatar avatar-lilac">AM</span><span><b>Alex Morgan</b><small>Own hours, calendar & calls</small></span><span className="role-tag">Coach</span></div>
        <div className="pool-note"><Icon id="layers" /><span>Any available coach: each call goes to a free coach, spread evenly.</span></div>
      </>
    ),
  },
]

const plans: Plan[] = [
  { id: 'solo', name: 'Solo', icon: 'home', description: 'Everything a solo coaching business needs.', monthly: 39, yearly: 31, seats: 'One owner-coach', includes: ['Booking pages & custom questions', 'Google Calendar & Zoom', 'Card payments & refunds', 'Email confirmations & reminders'] },
  { id: 'studio', name: 'Studio', icon: 'people', description: 'A connected workspace for a small team.', monthly: 99, yearly: 79, featured: 'FOR GROWING TEAMS', seats: 'Up to 5 staff members', includes: ['Everything in Solo', 'Owner, administrator & coach roles', 'Shared booking pages', 'Business hours & team free times'] },
  { id: 'practice', name: 'Practice', icon: 'layers', description: 'More room for an established practice.', monthly: 199, yearly: 159, seats: 'Up to 15 staff members', includes: ['Everything in Studio', 'Room for coaches & administrators', 'Coaches across several businesses', 'Fair assignment across your team'] },
]

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

          <div className="product-scene" aria-label="Illustrative preview of the schedulefa.st workspace">
            <div className="scene-glow" aria-hidden="true"></div>
            <div className="app-window">
              <aside className="app-sidebar" aria-hidden="true">
                <div className="app-brand"><BrandMark className="lp-mark" /><span>schedulefa.st</span></div>
                <div className="workspace-label"><span className="workspace-monogram">W</span><span>Willow Coaching<small>Your workspace</small></span><span className="workspace-chevron">⌄</span></div>
                <div className="app-menu">
                  <span className="active"><Icon id="home" />Today</span>
                  <span><Icon id="calendar" />Bookings <b>7</b></span>
                  <span><Icon id="link" />Booking pages</span>
                  <span><Icon id="clock" />Availability</span>
                  <span><Icon id="people" />Team</span>
                  <span><Icon id="card" />Payments</span>
                </div>
                <div className="sidebar-bottom"><span className="avatar avatar-sage">AM</span><span>Alex Morgan<small>Owner & coach</small></span><span>⌄</span></div>
              </aside>
              <div className="app-main">
                <div className="app-topbar"><span>Workspace <span className="breadcrumb">/</span> Today</span><span className="today-label">Wednesday, November 4 <i></i></span></div>
                <div className="app-content">
                  <div className="app-heading"><div><p>TODAY</p><h2>Your calls, at a glance.</h2><span>Every booking. Every link. Every reminder.</span></div><span className="small-date">NOV<br /><strong>04</strong></span></div>
                  <div className="app-stats">
                    <div><span>Calls this week <Icon id="calendar" /></span><strong>7 <small>booked through your pages</small></strong></div>
                    <div><span>Paid this week <Icon id="card" /></span><strong>$540 <small>to your own Stripe account</small></strong></div>
                    <div><span>Reminders sent <Icon id="mail" /></span><strong>12 <small>24 hours before each call</small></strong></div>
                  </div>
                  <div className="app-panels">
                    <div className="pipeline-panel">
                      <div className="panel-heading"><h3>Upcoming bookings</h3><span>All bookings <span aria-hidden="true">↗</span></span></div>
                      <table className="client-table" aria-label="Illustrative upcoming bookings">
                        <thead><tr><th>Guest</th><th>Call</th><th>Status</th></tr></thead>
                        <tbody>
                          <tr><td><span className="avatar avatar-peach">JL</span><span><b>Jamie Lee</b><small>Free intro call</small></span></td><td>Thu · 10:00 AM</td><td><span className="pipeline-status status-blue">Confirmed</span></td></tr>
                          <tr><td><span className="avatar avatar-lilac">NC</span><span><b>Noah Carter</b><small>Tutoring session</small></span></td><td>Thu · 4:30 PM</td><td><span className="pipeline-status status-green">Paid $45</span></td></tr>
                          <tr><td><span className="avatar avatar-sage">SR</span><span><b>Sophie Reynolds</b><small>Weekly check-in</small></span></td><td>Today · 2:00 PM</td><td><span className="pipeline-status">Zoom link sent</span></td></tr>
                        </tbody>
                      </table>
                      <div className="pipeline-footer"><Icon id="layers" /><span>3 booking pages live, one shared by your team</span><span aria-hidden="true">→</span></div>
                    </div>
                    <div className="next-panel">
                      <div className="panel-heading"><h3>Today&apos;s schedule</h3><span>•••</span></div>
                      <p className="next-label">YOUR NEXT CALL</p>
                      <div className="next-client"><span className="avatar avatar-peach">SR</span><div><b>Sophie Reynolds</b><small>Weekly check-in</small></div></div>
                      <div className="next-detail"><Icon id="clock" />Today, 2:00 – 3:00 PM</div>
                      <div className="next-detail"><Icon id="video" />Zoom link ready</div>
                      <div className="paid-status"><Icon id="check" />Paid & on Google Calendar</div>
                      <div className="next-divider"></div>
                      <div className="reminder-ready"><span className="mail-circle"><Icon id="mail" /></span><div><b>Reminder delivered</b><small>Sent 24 hours before the call</small></div><Icon id="check" className="check-small" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="floating-note"><span className="floating-icon"><Icon id="calendar" /></span><div><b>New booking from your page</b><span>Confirmation and calendar invite sent.</span></div><span className="floating-check">✓</span></div>
          </div>
          <p className="preview-caption">Illustrative product preview · Sample data</p>
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
            <div className="followup-demo">
              <div><span className="ai-label"><Icon id="card" /> PAID BOOKING</span><span className="draft-label">Example</span></div>
              <h3>Tutoring session · $45</h3>
              <p>Paid by card at booking. Full refund if cancelled 24 hours or more before the call.</p>
              <div className="draft-bottom"><span>Paid to: your Stripe account</span><span className="draft-action">No fee from schedulefa.st</span></div>
            </div>
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
              <p>Create your business and take bookings for free today.<br />Paid plans for growing teams are on the way, priced by staff seats.</p>
            </div>
            <PricingPlans plans={plans} />
            <p className="pricing-footnote">Paid plans aren’t live yet. These are planned launch prices in USD and may change; nothing is charged today.<br />schedulefa.st takes no fee on your coaching payments. Stripe’s standard processing fees apply.</p>
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
