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
        <li><strong>Information from Google, if you choose “Continue with Google”:</strong> your name, email address and profile picture from your Google account’s basic profile. Signing in with Google does not give us access to your Gmail, Google Drive, Google Calendar or contacts.</li>
        <li><strong>Google Calendar, only if you choose to connect it:</strong> the times your selected calendars are busy (not what your events are), the names of your calendars so you can choose which to use, and the events schedulefa.st itself adds for your bookings. See “Google user data” below.</li>
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
        your account and sign you in.
      </p>
      <p>If a coach connects Google Calendar, schedulefa.st:</p>
      <ul>
        <li><strong>Reads busy times</strong> from the calendars the coach selects, so families can’t book over existing commitments. We see only that a time is busy, not the event’s title, attendees or details, and we don’t store these busy times; we check them when availability is shown or a booking is made.</li>
        <li><strong>Reads the list of the coach’s calendars</strong> (names and IDs), so the coach can choose which calendars to check and which one receives bookings.</li>
        <li><strong>Adds, updates and removes events for bookings made in schedulefa.st</strong>, on a calendar the coach owns and chooses. We never read, change or delete other events.</li>
        <li><strong>Stores</strong> the connected Google account’s email address, the calendars chosen, and an access token, which is encrypted.</li>
      </ul>
      <p>
        Google user data is used only to provide these features to the person who connected it. We do not sell it, share it with anyone except
        the service providers listed below who help us run schedulefa.st, use it for advertising, or use it to train AI models, and no person
        at schedulefa.st reads it unless you ask us to for support or the law requires it. A coach can disconnect Google Calendar at any time
        in Settings → Integrations, which deletes the stored token and revokes our access. Our use of information received from Google APIs
        adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
        including the Limited Use requirements.
      </p>

      <h2>Who we share information with</h2>
      <p>We use a small number of service providers that process information on our behalf, only to run schedulefa.st:</p>
      <ul>
        <li><strong>Supabase</strong>, for our database and sign-in.</li>
        <li><strong>Vercel</strong>, for hosting the website.</li>
        <li><strong>Resend</strong>, to send account emails.</li>
        <li><strong>Google</strong>, when a coach connects Google Calendar.</li>
        <li><strong>Stripe</strong>, when a business connects its own Stripe account to take payments.</li>
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
