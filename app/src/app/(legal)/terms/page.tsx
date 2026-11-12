import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT_EMAIL, OPERATOR, POLICIES_UPDATED } from '@/lib/site'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground text-sm">Last updated {POLICIES_UPDATED}</p>

      <p>
        These terms apply to your use of schedulefa.st, operated by {OPERATOR} (“we”, “us”). By creating an account or using
        schedulefa.st, you agree to them. If you use schedulefa.st on behalf of a business, you agree on behalf of that business.
      </p>

      <h2>The service</h2>
      <p>
        schedulefa.st is software for running a coaching or tutoring business: booking pages, team scheduling, calendar and meeting
        connections, payments, clients, packages and files. It is in early access: features are being added and may change, and we may
        occasionally need to pause the service for maintenance.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 years old to create an account.</li>
        <li>Give accurate information and keep your sign-in details secure. You are responsible for activity in your account.</li>
        <li>Owners of a business account decide who on their team has access, and are responsible for the people they invite.</li>
      </ul>

      <h2>Your business and the families you work with</h2>
      <ul>
        <li>
          You are responsible for the information you collect and keep in schedulefa.st about the people you work with, including the
          questions you ask on booking pages, client and guardian records, and files you upload. Make sure you have the right to collect and
          use it, including any consent required from a parent or guardian for a child’s information, and that you tell families how you use
          it.
        </li>
        <li>
          Your services, prices, cancellation and refund rules, and your agreements with families are between you and them. schedulefa.st
          provides the tools; it is not a party to those agreements.
        </li>
        <li>Do not upload files you don’t have the right to share, or anything harmful such as malware.</li>
      </ul>

      <h2>Payments from families</h2>
      <p>
        If you take payments, families pay your business directly through your own Stripe account. Stripe’s terms, including the{' '}
        <a href="https://stripe.com/connect-account/legal" target="_blank" rel="noreferrer">Stripe Connected Account Agreement</a>, apply to
        those payments. schedulefa.st takes no fee on them; Stripe’s processing fees apply. You are responsible for refunds, disputes and
        taxes on your own sales.
      </p>

      <h2>Plans and billing</h2>
      <ul>
        <li>
          <strong>Free plan:</strong> you can use schedulefa.st for free within the free plan’s limits, which are shown on our{' '}
          <Link href="/#pricing">pricing</Link> page. We may change those limits; if we do, what you’ve already set up keeps working.
        </li>
        <li>
          <strong>Paid plans</strong> (Solo and Team) are billed in advance, yearly or monthly, at the prices shown when you subscribe, plus
          any applicable taxes. They renew automatically at the end of each period until you cancel.
        </li>
        <li>
          <strong>Team</strong> is billed per person for everyone on your team. When someone joins, you are charged for them right away for
          the rest of the period; when someone leaves, unused time becomes a credit on your next invoice. Switching plan or billing period
          works the same way.
        </li>
        <li>
          <strong>Cancelling:</strong> you can cancel any time in Settings → Subscription. Your plan stays active until the end of the period
          you paid for, then your business moves to the free plan. We don’t refund partial periods, except where the law requires it.
        </li>
        <li>
          <strong>Failed payments:</strong> if a renewal payment fails, Stripe will retry it and we may email you. If it can’t be collected,
          your business moves to the free plan.
        </li>
        <li>
          <strong>Price changes:</strong> we will give you at least 30 days’ notice by email before a price change applies to your plan, and
          it applies from your next renewal.
        </li>
      </ul>

      <h2>Other services</h2>
      <p>
        Some features connect to services run by others, such as Google Calendar, Zoom and Stripe. Your use of them is also subject to their
        terms, and we are not responsible for their availability.
      </p>

      <h2>Acceptable use</h2>
      <p>Do not use schedulefa.st to break the law, to harm or harass anyone, to send spam, or to try to access data that isn’t yours or to disrupt the service.</p>

      <h2>Your content</h2>
      <p>
        You own the information you and your business put into schedulefa.st. You give us permission to store and process it only as
        needed to provide the service to you. How we handle personal information is described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>No warranty</h2>
      <p>
        schedulefa.st is provided “as is” and “as available”, without warranties of any kind, to the extent the law allows. We work to keep
        it reliable and secure, but we can’t promise it will always be available or error-free.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, or for lost profits or data, arising from your
        use of schedulefa.st, and our total liability is limited to the amount you paid us in the 12 months before the claim.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using schedulefa.st, cancel your plan, and ask us to delete your account at any time by emailing {email}. We may
        suspend or close accounts that break these terms.
      </p>

      <h2>Changes to these terms</h2>
      <p>If we change these terms, we will update the date above, and for significant changes we will let account holders know by email before they take effect.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: {email}.</p>
    </article>
  )
}
