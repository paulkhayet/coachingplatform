'use server'

import { redirect } from 'next/navigation'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import { guestBookingSchema } from '@/lib/booking/schemas'
import { bookCall, findPublicPage } from '@/lib/booking/server'

export interface GuestBookingState {
  errors?: FieldErrors
  message?: string
  /** Set when the chosen time is gone, so the picker can refresh. */
  taken?: boolean
}

const reasons = {
  taken: 'Sorry, that time was just taken or is no longer available. Please choose another.',
  limit: 'You already have the maximum number of upcoming calls on this page.',
  calendar: 'We can’t confirm times right now. Please try again in a few minutes.',
}

export async function bookAction(businessSlug: string, pageSlug: string, _prev: GuestBookingState, formData: FormData): Promise<GuestBookingState> {
  const pub = await findPublicPage(businessSlug, pageSlug)
  if (!pub) return { message: 'This booking page isn’t available any more.' }
  const parsed = guestBookingSchema.safeParse({
    start: formData.get('start'),
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    notes: formData.get('notes') ?? '',
    timezone: formData.get('timezone') ?? '',
    website: formData.get('website') ?? '',
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  let result: Awaited<ReturnType<typeof bookCall>>
  try {
    result = await bookCall(pub, parsed.data)
  } catch (error) {
    console.error('Booking failed', error)
    return { message: 'Something went wrong booking your call. Please try again.' }
  }
  if (!result.ok) return { message: reasons[result.reason], taken: result.reason === 'taken' }
  redirect(`/b/${businessSlug}/${pageSlug}/booked/${result.bookingId}`)
}
