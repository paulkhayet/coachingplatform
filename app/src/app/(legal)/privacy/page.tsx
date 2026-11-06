import type { Metadata } from 'next'
import { CONTACT_EMAIL, OPERATOR, POLICIES_UPDATED } from '@/lib/site'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground text-sm">Last updated {POLICIES_UPDATED}</p>

      <p>
        schedulefa.st is software that helps coaching businesses run their work: their team, and, as features launch, booking, enrollment,
        payments, sessions and follow-ups. It is operated by {OPERATOR} (“we”, “us”). This policy explains what information we collect when
        you use schedulefa.st at www.schedulefa.st, how we use it, and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> your name, email address and, if you choose one, a password. Passwords are stored only as secure hashes by our authentication provider; we never see them.</li>
        <li><strong>Information from Google, if you choose “Continue with Google”:</strong> your name, email address and profile picture from your Google account’s basic profile. We do not request access to your Gmail, Google Drive, Google Calendar or contacts.</li>
        <li><strong>Business information you enter:</strong> your business name, booking link, time zone, and the members of your team with their roles.</li>
        <li><strong>Technical information:</strong> cookies that keep you signed in, and standard server logs (such as IP address, browser type and the time of a request) used to run and secure the service.</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To create your account, sign you in and keep your account secure.</li>
        <li>To provide the service to you and the people in your business.</li>
        <li>To send emails you need, such as confirming your email address or a sign-in link you requested.</li>
        <li>To respond when you contact us, and to fix problems.</li>
      </ul>
      <p>We do not sell your information, and we do not use it for advertising.</p>

      <h2>Google user data</h2>
      <p>
        When you sign in with Google, we receive only your basic profile (name, email address and profile picture). We use it only to create
        your account and sign you in. We do not share it with anyone except the service providers listed below who help us run
        schedulefa.st, and we do not use it for advertising or to train AI models. Our use of information received from Google APIs adheres
        to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
        including the Limited Use requirements.
      </p>

      <h2>Who we share information with</h2>
      <p>We use a small number of service providers that process information on our behalf, only to run schedulefa.st:</p>
      <ul>
        <li><strong>Supabase</strong>, for our database and sign-in.</li>
        <li><strong>Vercel</strong>, for hosting the website.</li>
        <li><strong>Our email delivery provider</strong>, to send account emails.</li>
      </ul>
      <p>
        Inside schedulefa.st, information about a business is visible only to active members of that business. We may also disclose
        information if the law requires it.
      </p>

      <h2>Where information is stored and how it is protected</h2>
      <p>
        Information is stored in the United States. It is encrypted in transit, and access is restricted so that each business can only see
        its own data.
      </p>

      <h2>How long we keep information</h2>
      <p>
        We keep your information while your account is active. If you ask us to delete your account, we delete your information within 30
        days, except where we must keep it to meet a legal obligation.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask us to access, correct, export or delete your information at any time by emailing {email}. If you signed in with Google,
        you can also remove schedulefa.st’s access from your{' '}
        <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">Google account settings</a>.
      </p>

      <h2>Children</h2>
      <p>
        schedulefa.st accounts are for coaching businesses and their staff, and are not intended for children under 13. Features for
        families and students will be described in this policy before they launch.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we will update the date above. If the changes are significant, we will let account holders know by email
        before they take effect.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy or your information: {email}.</p>
    </article>
  )
}
