'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { bookingIdFromToken, cancelBooking, rescheduleBooking } from '@/lib/booking/server'

// Guest changes through their emailed link (D-056). The signed token is the only credential.

export interface ManageState {
  message?: string
  ok?: boolean
}

export async function cancelAsGuest(token: string, _prev: ManageState): Promise<ManageState> {
  const id = bookingIdFromToken(token)
  if (!id) return { message: 'This link isn’t valid.' }
  const result = await cancelBooking(id, 'guest')
  if (!result.ok) return { message: 'This call can’t be cancelled any more.' }
  redirect(`/m/${token}?done=cancelled${result.refundFailed ? '&refund=failed' : ''}`)
}

export async function rescheduleAsGuest(token: string, _prev: ManageState, formData: FormData): Promise<ManageState> {
  const id = bookingIdFromToken(token)
  if (!id) return { message: 'This link isn’t valid.' }
  const start = z.iso.datetime({ offset: true }).safeParse(formData.get('start'))
  if (!start.success) return { message: 'Choose a new time.' }
  const result = await rescheduleBooking(id, new Date(start.data))
  if (!result.ok) {
    return {
      message: result.reason === 'taken' ? 'Sorry, that time was just taken. Please choose another.' : result.reason === 'calendar' ? 'We can’t confirm times right now. Please try again in a few minutes.' : 'This call can’t be changed any more.',
    }
  }
  redirect(`/m/${token}?done=moved`)
}
