import 'server-only'
import type { EmailMessage } from '@/lib/booking/emails'

// App emails through Resend's API (D-052, D-056), from the verified schedulefa.st domain.
// Without RESEND_API_KEY (e.g. a fresh local setup) emails are skipped and logged instead.

const apiKey = process.env.RESEND_API_KEY ?? ''
const FROM = 'schedulefa.st <no-reply@schedulefa.st>'

export const isEmailConfigured = Boolean(apiKey)

export async function sendEmail(to: string, message: EmailMessage, opts: { replyTo?: string | null; idempotencyKey?: string } = {}): Promise<boolean> {
  if (!apiKey) {
    console.info(`[email skipped: RESEND_API_KEY not set] to=${to} subject="${message.subject}"`)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        // Resend drops a repeat with the same key, so a retried job can't email twice.
        ...(opts.idempotencyKey ? { 'idempotency-key': opts.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: FROM, to: [to], subject: message.subject, html: message.html, text: message.text, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
    })
    if (!res.ok) {
      console.error(`Resend rejected an email (${res.status}): ${await res.text().catch(() => '')}`)
      return false
    }
    return true
  } catch (error) {
    console.error('Sending email failed', error)
    return false
  }
}
