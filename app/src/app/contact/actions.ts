'use server'

import { and, eq, gt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { adminDb } from '@/db/server'
import { contactRequests } from '@/db/schema'
import { sendEmail } from '@/lib/email/server'
import { contactRequestEmail } from '@/lib/booking/emails'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import { TEAM_SIZES } from './sizes'

// D-067: the public contact form (e.g. Corporate plan enquiries). Every request is stored, then emailed to
// CONTACT_TO_EMAIL (a server setting, so the address never appears on the site).

export interface ContactState {
  ok?: boolean
  message?: string
  errors?: FieldErrors
  values?: Record<string, string>
}

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120, 'Keep your name under 120 characters'),
  email: z.email('Enter a valid email address').max(254),
  organization: z.string().trim().min(1, 'Enter your organization').max(160, 'Keep this under 160 characters'),
  teamSize: z.enum(TEAM_SIZES, 'Choose your team size'),
  message: z.string().trim().max(4000, 'Keep your message under 4,000 characters'),
  plan: z.enum(['corporate', 'team', 'solo', 'other']).catch('other'),
})

const MAX_PER_HOUR = 3

export async function sendContactRequest(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const values = Object.fromEntries(['name', 'email', 'organization', 'teamSize', 'message', 'plan'].map((k) => [k, String(formData.get(k) ?? '')]))
  // Hidden from people; bots that fill every field get a quiet "thanks".
  if (String(formData.get('website') ?? '')) return { ok: true }
  const parsed = schema.safeParse({ ...values, email: values.email.trim().toLowerCase() })
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values }
  const d = parsed.data

  const db = adminDb()
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(contactRequests)
    .where(and(eq(contactRequests.email, d.email), gt(contactRequests.createdAt, sql`now() - interval '1 hour'`)))
  if (recent >= MAX_PER_HOUR) return { message: 'We already have your message. We’ll be in touch soon.', values }

  const [row] = await db
    .insert(contactRequests)
    .values({ name: d.name, email: d.email, organization: d.organization, teamSize: d.teamSize, message: d.message || null, plan: d.plan })
    .returning({ id: contactRequests.id })

  const to = process.env.CONTACT_TO_EMAIL
  if (to) {
    const sent = await sendEmail(to, contactRequestEmail({ ...d, message: d.message || null }), { replyTo: d.email, idempotencyKey: `contact:${row.id}` })
    if (sent) await db.update(contactRequests).set({ emailed: true }).where(eq(contactRequests.id, row.id))
  } else {
    console.info(`[contact request saved, not emailed: CONTACT_TO_EMAIL not set] id=${row.id}`)
  }
  return { ok: true, values: { name: d.name, email: d.email } }
}
