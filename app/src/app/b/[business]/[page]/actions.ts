'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import { guestBookingSchema } from '@/lib/booking/schemas'
import { parseQuestions, readAnswers } from '@/lib/booking/questions'
import { bookCall, findPublicPage } from '@/lib/booking/server'

export interface GuestBookingState {
  errors?: FieldErrors
  message?: string
  /** Set when the chosen time is gone, so the picker can refresh. */
  taken?: boolean
  /** What the guest typed, so the form can refill itself after an error (React resets forms on submit). */
  values?: Record<string, string | string[]>
}

const reasons = {
  taken: 'Sorry, that time was just taken or is no longer available. Please choose another.',
  limit: 'You already have the maximum number of upcoming calls on this page.',
  calendar: 'We can’t confirm times right now. Please try again in a few minutes.',
  payments: 'This call can’t be booked online right now. Please contact the business.',
}

const student = z.object({
  name: z.string().trim().min(1, 'Enter the student’s name').max(120, 'Keep the name under 120 characters'),
  grade: z.string().trim().max(40, 'Keep the grade under 40 characters'),
})

export async function bookAction(businessSlug: string, pageSlug: string, _prev: GuestBookingState, formData: FormData): Promise<GuestBookingState> {
  const pub = await findPublicPage(businessSlug, pageSlug)
  if (!pub) return { message: 'This booking page isn’t available any more.' }
  const values: Record<string, string | string[]> = {}
  for (const key of new Set(formData.keys())) {
    if (key === 'name' || key === 'email' || key === 'notes' || key === 'studentName' || key === 'studentGrade') values[key] = String(formData.get(key) ?? '')
    else if (key.startsWith('q_')) values[key] = formData.getAll(key).map(String)
  }
  const parsed = guestBookingSchema.safeParse({
    start: formData.get('start'),
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    notes: formData.get('notes') ?? '',
    timezone: formData.get('timezone') ?? '',
    website: formData.get('website') ?? '',
  })
  const errors: FieldErrors = parsed.success ? {} : fieldErrors(parsed.error)

  let studentName: string | null = null
  let studentGrade: string | null = null
  if (pub.page.askStudent) {
    const s = student.safeParse({ name: formData.get('studentName') ?? '', grade: formData.get('studentGrade') ?? '' })
    if (s.success) {
      studentName = s.data.name
      studentGrade = s.data.grade || null
    } else {
      for (const issue of s.error.issues) errors[issue.path[0] === 'name' ? 'studentName' : 'studentGrade'] ??= issue.message
    }
  }
  const { answers, errors: answerErrors } = readAnswers(parseQuestions(pub.page.questions), (n) => formData.getAll(n).map(String))
  Object.assign(errors, answerErrors)
  if (!parsed.success || Object.keys(errors).length) return { errors, values }

  let result: Awaited<ReturnType<typeof bookCall>>
  try {
    result = await bookCall(pub, parsed.data, { answers, studentName, studentGrade })
  } catch (error) {
    console.error('Booking failed', error)
    return { message: 'Something went wrong booking your call. Please try again.', values }
  }
  if (!result.ok) return { message: reasons[result.reason], taken: result.reason === 'taken', values }
  // Paid calls go to Stripe Checkout; free calls straight to the confirmation.
  redirect(result.checkoutUrl ?? `/b/${businessSlug}/${pageSlug}/booked/${result.bookingId}`)
}
