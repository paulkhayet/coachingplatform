// Booking emails (D-056). Pure templates: each returns a subject plus plain-text and HTML bodies.

export interface EmailMessage {
  subject: string
  text: string
  html: string
}

export interface CallDetails {
  businessName: string
  title: string
  hostName: string
  guestName: string
  start: Date
  end: Date
  timeZone: string
  location?: string | null
  manageUrl?: string
  /** e.g. "$45 paid" */
  paymentLine?: string
  /** The business's public logo (D-071), shown at the top of the email. */
  logoUrl?: string | null
}

/** Who an email is from: the business's logo (or its name, without one) heads the message. */
export interface Brand {
  name: string
  logoUrl?: string | null
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function whenText(start: Date, end: Date, timeZone: string) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(start)
  const t = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  const zone = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(start).find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  return `${day}, ${t.format(start)} – ${t.format(end)} ${zone}`
}

function brandHeader(brand: Brand) {
  return brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" height="48" style="display:block;height:48px;max-width:200px;width:auto;margin:0 0 24px;border:0;object-fit:contain">`
    : `<p style="font-size:15px;font-weight:600;margin:0 0 24px;color:#17181c">${esc(brand.name)}</p>`
}

function render(heading: string, paragraphs: string[], details: [string, string][], action?: { label: string; url: string }, footer?: string, brand?: Brand): { text: string; html: string } {
  const text = [heading, '', ...paragraphs, '', ...details.map(([k, v]) => `${k}: ${v}`), ...(action ? ['', `${action.label}: ${action.url}`] : []), ...(footer ? ['', footer] : [])].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#17181c">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
${brand ? brandHeader(brand) : ''}
<h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${esc(p)}</p>`).join('\n')}
<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border:1px solid #e5e7eb;border-radius:8px">
${details.map(([k, v]) => `<tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;width:110px;vertical-align:top">${esc(k)}</td><td style="padding:10px 14px;font-size:14px">${/^https?:\/\//.test(v) ? `<a href="${esc(v)}" style="color:#3f61ea">${esc(v)}</a>` : esc(v)}</td></tr>`).join('\n')}
</table>
${action ? `<p style="margin:20px 0"><a href="${esc(action.url)}" style="background:#3f61ea;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;display:inline-block">${esc(action.label)}</a></p>` : ''}
${footer ? `<p style="font-size:12px;color:#6b7280;margin-top:24px">${esc(footer)}</p>` : ''}
<p style="font-size:12px;color:#9ca3af;margin-top:24px">Sent by schedulefa.st, the scheduling software this business uses.</p>
</div></body></html>`
  return { text, html }
}

function detailRows(d: CallDetails): [string, string][] {
  const rows: [string, string][] = [
    ['What', d.title],
    ['When', whenText(d.start, d.end, d.timeZone)],
    ['With', d.hostName],
  ]
  if (d.location) rows.push(['Where', d.location])
  if (d.paymentLine) rows.push(['Payment', d.paymentLine])
  return rows
}

const brandOf = (d: CallDetails): Brand => ({ name: d.businessName, logoUrl: d.logoUrl })

const changeFooter = (d: CallDetails) => (d.manageUrl ? 'You can reschedule or cancel with the button above until the call starts. Reply to this email to reach the host.' : 'Reply to this email to reach the host.')

export function guestConfirmation(d: CallDetails): EmailMessage {
  const subject = `Booked: ${d.title} with ${d.businessName}`
  return { subject, ...render(`You’re booked, ${d.guestName}`, [`Your ${d.title} with ${d.businessName} is confirmed.`], detailRows(d), d.manageUrl ? { label: 'Reschedule or cancel', url: d.manageUrl } : undefined, changeFooter(d), brandOf(d)) }
}

export function guestRescheduled(d: CallDetails): EmailMessage {
  const subject = `New time: ${d.title} with ${d.businessName}`
  return { subject, ...render('Your call has a new time', [`Your ${d.title} with ${d.businessName} has moved.`], detailRows(d), d.manageUrl ? { label: 'Reschedule or cancel', url: d.manageUrl } : undefined, changeFooter(d), brandOf(d)) }
}

export function guestReminder(d: CallDetails): EmailMessage {
  const subject = `Reminder: ${d.title} with ${d.businessName}`
  return { subject, ...render(`See you soon, ${d.guestName}`, [`This is a reminder of your ${d.title} with ${d.businessName}.`], detailRows(d), d.manageUrl ? { label: 'Reschedule or cancel', url: d.manageUrl } : undefined, changeFooter(d), brandOf(d)) }
}

export function reservationPaymentReminder(d: CallDetails, cutoff: Date | null): EmailMessage {
  const subject = `Payment needed for ${d.title} with ${d.businessName}`
  const paragraphs = ['We’re holding this time for your coaching session. Contact the business to arrange payment and receive your meeting details.']
  const rows = detailRows({ ...d, location: null, paymentLine: undefined })
  if (cutoff) {
    const format = new Intl.DateTimeFormat('en-US', { timeZone: d.timeZone, dateStyle: 'full', timeStyle: 'short' })
    rows.push(['Pay by', format.format(cutoff)])
    paragraphs.push('The reservation will be released if payment hasn’t covered the session by the deadline.')
  }
  return { subject, ...render(subject, paragraphs, rows, undefined, changeFooter(d), brandOf(d)) }
}

export function reservationPaymentCancelled(d: CallDetails): EmailMessage {
  const subject = `Reservation cancelled for ${d.title} with ${d.businessName}`
  return { subject, ...render(subject, ['The payment deadline passed and the reserved time was released. Contact the business to arrange a new session.'],
    detailRows({ ...d, location: null, paymentLine: undefined }), undefined, changeFooter(d), brandOf(d)) }
}

export function guestCancelled(d: CallDetails, by: 'guest' | 'business', refund: 'full' | 'none' | 'not_paid'): EmailMessage {
  const subject = `Cancelled: ${d.title} with ${d.businessName}`
  const lines = [by === 'guest' ? `You cancelled your ${d.title} with ${d.businessName}.` : `${d.businessName} cancelled your ${d.title}.`]
  if (refund === 'full') lines.push('You’ll get a full refund to your card. It usually appears within 5–10 business days.')
  if (refund === 'none') lines.push('This was cancelled after the refund cutoff, so the payment isn’t refunded. Reply to this email if you have questions.')
  return { subject, ...render('Your call is cancelled', lines, detailRows({ ...d, paymentLine: undefined, location: undefined }), undefined, undefined, brandOf(d)) }
}

export function hostNewBooking(d: CallDetails & { guestEmail: string | null; staffBooked?: boolean; extras: [string, string][] }): EmailMessage {
  const subject = `New booking: ${d.title} with ${d.guestName}`
  return { subject, ...render(d.staffBooked ? `${d.title} with ${d.guestName}` : `${d.guestName} booked ${d.title}`, [d.staffBooked ? 'A coaching session was scheduled for you.' : 'A new call was booked through your booking page.'], [...detailRows(d), ['Guest', d.guestEmail ? `${d.guestName} <${d.guestEmail}>` : d.guestName], ...d.extras], undefined, 'See all bookings in schedulefa.st → Bookings.') }
}

export function hostGuestChange(d: CallDetails & { guestEmail: string | null; staffMoved?: boolean }, change: 'cancelled' | 'rescheduled', refund?: 'full' | 'none' | 'not_paid'): EmailMessage {
  const subject = `${change === 'cancelled' ? 'Cancelled' : 'Rescheduled'}: ${d.title} with ${d.guestName}`
  const lines = [change === 'cancelled' ? `${d.guestName} cancelled their ${d.title}.` : d.staffMoved ? 'This coaching session was moved to a new time.' : `${d.guestName} moved their ${d.title} to a new time.`]
  if (refund === 'full') lines.push('They were refunded in full automatically.')
  if (refund === 'none') lines.push('It was after the refund cutoff, so no refund was made.')
  return { subject, ...render(subject, lines, [...detailRows(d), ['Guest', d.guestEmail ? `${d.guestName} <${d.guestEmail}>` : d.guestName]]) }
}

const possessive = (name: string) => `${name}’s`

/**
 * D-073: a copy of a student's session email for a parent or guardian with family portal access. Written
 * about the student rather than to them, with a link to the portal instead of a manage link.
 */
export function familySessionEmail(d: CallDetails & { portalUrl: string }, kind: 'booked' | 'moved' | 'reminder' | 'cancelled'): EmailMessage {
  const student = possessive(d.guestName)
  const copy = {
    booked: { subject: `Booked: ${student} ${d.title}`, heading: `${student} session is booked`, line: `${student} ${d.title} with ${d.businessName} is confirmed.` },
    moved: { subject: `New time: ${student} ${d.title}`, heading: `${student} session has a new time`, line: `${student} ${d.title} with ${d.businessName} has moved.` },
    reminder: { subject: `Reminder: ${student} ${d.title}`, heading: `${student} session is coming up`, line: `This is a reminder of ${student} ${d.title} with ${d.businessName}.` },
    cancelled: { subject: `Cancelled: ${student} ${d.title}`, heading: `${student} session is cancelled`, line: `${student} ${d.title} with ${d.businessName} was cancelled.` },
  }[kind]
  const rows = kind === 'cancelled' ? detailRows({ ...d, location: null, paymentLine: undefined }) : detailRows({ ...d, paymentLine: undefined })
  return {
    subject: copy.subject,
    ...render(copy.heading, [copy.line], rows, { label: 'Open the family portal', url: d.portalUrl },
      `You’re getting this because ${d.businessName} gave you access to ${student} family portal. Reply to this email to reach the coach.`, brandOf(d)),
  }
}

/** D-060: an owner invites someone to join their business. */
export function teamInviteEmail(d: { businessName: string; logoUrl?: string | null; inviterName: string; roleLabel: string; url: string; expires: Date }): EmailMessage {
  const until = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(d.expires)
  return {
    subject: `${d.inviterName} invited you to join ${d.businessName}`,
    ...render(
      `Join ${d.businessName} on schedulefa.st`,
      [
        `${d.inviterName} invited you to join ${d.businessName} as ${/^[aeiou]/i.test(d.roleLabel) ? 'an' : 'a'} ${d.roleLabel.toLowerCase()}.`,
        'If you already use schedulefa.st, your account, hours and calendar carry over, and you can switch between your businesses. If you’re new, you’ll create a free account first.',
      ],
      [['Business', d.businessName], ['Role', d.roleLabel]],
      { label: 'Accept the invitation', url: d.url },
      `The link works once and expires on ${until}. If you weren’t expecting this, you can ignore it.`,
      { name: d.businessName, logoUrl: d.logoUrl },
    ),
  }
}

/** D-073: a coaching business invites a parent or guardian to the family portal. */
export function familyInviteEmail(d: { businessName: string; logoUrl?: string | null; inviterName: string; clientName: string; url: string; expires: Date }): EmailMessage {
  const until = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(d.expires)
  return {
    subject: `${d.businessName} invited you to follow ${d.clientName}’s coaching`,
    ...render(
      `Your family portal for ${d.businessName}`,
      [
        `${d.inviterName} at ${d.businessName} invited you to the family portal for ${d.clientName}.`,
        'You’ll see upcoming sessions and meeting links, session credits and anything the coach shares with you. If you’re new to schedulefa.st, you’ll create a free account with this email first.',
      ],
      [['Business', d.businessName], ['Student', d.clientName]],
      { label: 'Open the invitation', url: d.url },
      `The link works once and expires on ${until}. If you weren’t expecting this, you can ignore it.`,
      { name: d.businessName, logoUrl: d.logoUrl },
    ),
  }
}

/** D-067: a sales enquiry from the public contact form, sent to the schedulefa.st team. */
export function contactRequestEmail(d: { name: string; email: string; organization: string; teamSize: string; message: string | null; plan: string | null }): EmailMessage {
  return {
    subject: `New ${d.plan === 'corporate' ? 'Corporate plan ' : ''}enquiry from ${d.organization}`,
    ...render(
      `${d.name} from ${d.organization} got in touch`,
      [d.message ? d.message : 'No message added.'],
      [['Name', d.name], ['Email', d.email], ['Organization', d.organization], ['Team size', d.teamSize], ['Plan', d.plan ?? 'Not specified']],
      undefined,
      'Reply to this email to answer them directly.',
    ),
  }
}
