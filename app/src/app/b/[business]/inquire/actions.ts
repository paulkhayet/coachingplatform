'use server'

import { after } from 'next/server'
import { adminDb } from '@/db/server'
import { workspacePlan } from '@/lib/billing/server'
import { parseQuestions, readAnswers } from '@/lib/booking/questions'
import { notifyNewInquiry, publicIntake, submitInquiry } from '@/lib/intake/server'
import { INQUIRY_FIELDS, checkInquiry } from '@/lib/intake/shared'
import type { FieldErrors } from '@/lib/validation'

export interface InquiryFormState {
  ok?: boolean
  message?: string
  errors?: FieldErrors
  /** Everything typed, so a failed submit doesn't lose it. */
  values?: Record<string, string[]>
  firstName?: string
}

const CLOSED = 'This form isn’t taking inquiries right now.'

/** The public inquiry form (D-074). No account: the server validates, limits and stores it. */
export async function sendInquiry(businessSlug: string, _state: InquiryFormState, form: FormData): Promise<InquiryFormState> {
  // Hidden from people; bots that fill every field get a quiet "thanks".
  if (String(form.get('website') ?? '')) return { ok: true }
  const values: Record<string, string[]> = {}
  for (const key of new Set(form.keys())) values[key] = form.getAll(key).filter((v): v is string => typeof v === 'string')
  const text = (key: string) => (values[key]?.[0] ?? '').trim()

  const found = await publicIntake(businessSlug)
  if (!found?.settings?.enabled || !(await workspacePlan(found.business.id)).limits.teamDashboard) return { message: CLOSED, values }

  const parsed = checkInquiry(Object.fromEntries(INQUIRY_FIELDS.map((k) => [k, text(k)])))
  const custom = readAnswers(parseQuestions(found.settings.questions), (name) => values[name] ?? [])
  const errors = { ...('errors' in parsed ? parsed.errors : {}), ...custom.errors }
  if ('errors' in parsed || Object.keys(errors).length) return { errors, values, message: 'Check the highlighted answers and try again.' }

  let result: Awaited<ReturnType<typeof submitInquiry>>
  try {
    result = await submitInquiry(adminDb(), found.business.id, parsed.data, custom.answers)
  } catch (error) {
    console.error('Saving an inquiry failed', error instanceof Error ? error.message : 'unknown error')
    return { message: 'That didn’t go through. Try again in a moment.', values }
  }
  if ('closed' in result) return { message: CLOSED, values }
  if ('limited' in result) {
    return result.limited === 'email'
      ? { message: `${found.business.name} already has your inquiry and will be in touch. If you need to add something, reply to the confirmation email.`, values }
      : { message: 'This form is busy right now. Try again in an hour.', values }
  }
  const { id } = result
  after(() => notifyNewInquiry(id))
  return { ok: true, firstName: parsed.data.contactName.split(' ')[0] }
}
