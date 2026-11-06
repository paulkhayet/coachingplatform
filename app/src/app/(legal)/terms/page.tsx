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
        schedulefa.st is software for running a coaching business. It is in early access: features are being added and may change, and we
        may occasionally need to pause the service for maintenance.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 years old to create an account.</li>
        <li>Give accurate information and keep your sign-in details secure. You are responsible for activity in your account.</li>
        <li>Owners of a business account decide who on their team has access, and are responsible for the people they invite.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Do not use schedulefa.st to break the law, to harm or harass anyone, to send spam, or to try to access data that isn’t yours or to disrupt the service.</p>

      <h2>Your content</h2>
      <p>
        You own the information you and your business put into schedulefa.st. You give us permission to store and process it only as
        needed to provide the service to you. How we handle personal information is described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Fees</h2>
      <p>schedulefa.st is free during early access. If we introduce paid plans, we will tell you in advance, and you will not be charged unless you choose a paid plan.</p>

      <h2>No warranty</h2>
      <p>
        schedulefa.st is provided “as is” and “as available”, without warranties of any kind, to the extent the law allows. We work to keep
        it reliable and secure, but we can’t promise it will always be available or error-free.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, or for lost profits or data, arising from your
        use of schedulefa.st.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using schedulefa.st and ask us to delete your account at any time by emailing {email}. We may suspend or close accounts
        that break these terms.
      </p>

      <h2>Changes to these terms</h2>
      <p>If we change these terms, we will update the date above, and for significant changes we will let account holders know by email before they take effect.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: {email}.</p>
    </article>
  )
}
