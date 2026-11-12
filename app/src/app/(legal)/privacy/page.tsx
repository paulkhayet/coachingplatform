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
        schedulefa.st is software that coaching and tutoring businesses use to run their work: booking pages, their team, clients and
        packages, payments and files. It is operated by {OPERATOR} (“we”, “us”). This policy explains what information we collect at
        www.schedulefa.st, how we use it, and the choices you have.
      </p>

      <h2>Who is responsible for what</h2>
      <p>
        For the people who sign up and work in schedulefa.st (owners, administrators and coaches), we decide how account information is
        used. For information a business keeps about its own families, such as people who book a call, its clients and their guardians,
        and the files it uploads, the business decides what to collect and why, and we process it on the business’s behalf to provide the
        service. If you are a family member or student, the business you work with is your first point of contact about your information;
        you can also contact us and we will pass your request to them.
      </p>

      <h2>Information we collect</h2>
      <h3>About people who use schedulefa.st (staff accounts)</h3>
      <ul>
        <li><strong>Account information:</strong> your name, email address and, if you choose one, a password. Passwords are stored only as secure hashes by our authentication provider; we never see them.</li>
        <li><strong>Profile photo</strong>, if you add one. It is visible to the people you work with.</li>
        <li><strong>Information from Google, if you choose “Continue with Google”:</strong> your name, email address and profile picture from your Google account’s basic profile. Signing in with Google does not give us access to your Gmail, Google Drive, Google Calendar or contacts.</li>
        <li><strong>Google Calendar, only if you connect it:</strong> the times your selected calendars are busy (not what your events are), the names of your calendars so you can choose which to use, and the events schedulefa.st itself adds for your bookings. See “Google user data” below.</li>
        <li><strong>Zoom, only if you connect it:</strong> your Zoom account’s user ID and email address, and access tokens (stored encrypted) that let us create, move and delete a meeting for each booking that uses Zoom. We do not access your recordings, chats or other meetings.</li>
        <li><strong>Your working hours and time off</strong>, so families can only book when you are available.</li>
      </ul>

      <h3>About businesses</h3>
      <ul>
        <li>The business name, booking link, time zone, opening hours and team members with their roles.</li>
        <li><strong>Public profile:</strong> the logo, description, website and contact email a business chooses to show on its booking pages. These are public by design.</li>
        <li><strong>Plan and billing:</strong> the business’s schedulefa.st plan, its status and the number of people billed. Card details are handled by Stripe; we never see or store full card numbers.</li>
        <li><strong>Payments set-up:</strong> if the business connects its own Stripe account to take payments, the account’s ID and status.</li>
      </ul>

      <h3>About families, entered by guests or by a business</h3>
      <ul>
        <li><strong>People who book a call:</strong> their name and email address, their time zone, the time they booked, their answers to the business’s questions, and an optional note. If a call is paid, the payment is made to the business through Stripe; we receive the payment’s status, not card details.</li>
        <li><strong>Clients and guardians</strong> that a business adds: names, email addresses, phone numbers, how a guardian is related to a client, and the coach assigned. Clients may be children; their details are entered by the business, usually as provided by a parent or guardian.</li>
        <li><strong>Coaching records</strong> a business keeps: packages assigned, session credits, sessions booked and attended, and payments the business records as received.</li>
        <li><strong>Files</strong> a business uploads to a client’s record, such as worksheets or notes. They are private to the business’s staff who can see that client.</li>
      </ul>

      <h3>Other</h3>
      <ul>
        <li><strong>Messages you send us</strong>, for example through the contact form: your name, email address and message.</li>
        <li><strong>Technical information:</strong> cookies that keep you signed in, and standard server logs (such as IP address, browser type and the time of a request) used to run and secure the service. We don’t use advertising or tracking cookies.</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To provide the service: show booking pages, prevent double-booking, add bookings to calendars, create meeting links, and keep each business’s records.</li>
        <li>To send emails on a business’s behalf: booking confirmations, reminders, reschedules, cancellations and payment reminders to the people who booked or the contact a business chose.</li>
        <li>To send emails you need, such as confirming your email address, sign-in links and team invitations.</li>
        <li>To bill businesses for their schedulefa.st plan.</li>
        <li>To keep the service secure, respond when you contact us, and fix problems.</li>
      </ul>
      <p>We do not sell personal information, we do not use it for advertising, and we do not use it to train AI models.</p>

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

      <h2>Who can see information</h2>
      <p>
        Inside schedulefa.st, a business’s information is visible only to its active members, and roles limit what each person sees: for
        example, coaches see only the clients assigned to them, and guardian contacts and payment records are visible to owners and
        administrators. A business’s public profile and booking pages can be seen by anyone with the link.
      </p>
      <p>We use a small number of service providers that process information on our behalf, only to run schedulefa.st:</p>
      <ul>
        <li><strong>Supabase</strong>, for our database, sign-in and file storage.</li>
        <li><strong>Vercel</strong>, for hosting the website.</li>
        <li><strong>Resend</strong>, to send emails.</li>
        <li><strong>Google</strong>, when a coach connects Google Calendar.</li>
        <li><strong>Zoom</strong>, when a coach connects Zoom.</li>
        <li><strong>Stripe</strong>, to process payments families make to businesses, and to bill businesses for their schedulefa.st plan.</li>
      </ul>
      <p>We may also disclose information if the law requires it, or to protect the safety of people or the service.</p>

      <h2>Where information is stored and how it is protected</h2>
      <p>
        Information is stored in the United States. It is encrypted in transit; connection tokens for Google and Zoom are also encrypted at
        rest. Each business can see only its own data, client files are kept in private storage and opened through short-lived links, and
        only the logos businesses choose to publish are public.
      </p>

      <h2>How long we keep information</h2>
      <p>
        We keep information while the account or business it belongs to is active, so the business keeps its booking and client history.
        A business can delete files and edit its records at any time. If an account or business is deleted, we delete its information within
        30 days, except where we must keep it to meet a legal obligation (for example, billing records).
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask us to access, correct, export or delete your information at any time by emailing {email}. If your information was entered
        by a coaching business, we will work with that business to respond. If you signed in with Google, you can also remove schedulefa.st’s
        access from your{' '}
        <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">Google account settings</a>, and coaches can
        disconnect Google Calendar and Zoom in Settings → Integrations.
      </p>

      <h2>Children</h2>
      <p>
        schedulefa.st accounts are for adults who run or work for coaching businesses. Children do not have accounts and do not use
        schedulefa.st directly. A business may keep records about students who are children, such as their name, sessions and files; that
        information is entered by the business, usually as provided by a parent or guardian, and the business is responsible for having the
        right to collect it, including any parental consent the law requires. A parent or guardian can ask the business, or us, to review or
        delete a child’s information.
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
