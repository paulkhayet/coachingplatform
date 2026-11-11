'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { adminDb } from '@/db/server'
import { afterBookingCancelled, afterConfirmed, availableCoachingStarts } from '@/lib/booking/server'
import { coachingAvailabilitySetup, CoachingSessionError, finishCoachingSession, reserveCoachingSession } from '@/lib/clients/sessions'
import { businessDate } from '@/lib/clients/credits'
import { canManageClients } from '@/lib/roles'
import { requireWorkspace } from '@/lib/workspace'
import { isZoomConfigured, withoutZoom } from '@/lib/zoom/server'

const uuid = z.uuid()
const choiceFields = z.object({ coachId: uuid, formatIndex: z.string().regex(/^\d+$/).transform(Number), day: z.iso.date() })
const bookingFields = z.object({
  startsAt: z.iso.datetime({ offset: true }), locationType: z.enum(['video_link', 'phone', 'in_person', 'zoom']),
  locationDetail: z.string().max(500), contact: z.union([z.literal('none'), z.literal('client'), uuid]),
  noticeHours: z.union([z.literal(''), z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(720))]),
  lateCancellation: z.union([z.literal(''), z.enum(['preserve', 'forfeit'])]),
})

export interface CoachingBookingState {
  message?: string
  slots?: string[]
  selection?: { coachId: string; formatIndex: number; day: string }
}

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function conflict(error: unknown) {
  return error instanceof Error && ('code' in error && error.code === '23P01' || (error.cause instanceof Error && 'code' in error.cause && error.cause.code === '23P01'))
}

function isVideoUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

export async function bookCoachingAction(businessId: string, clientId: string, periodId: string, requestId: string, state: CoachingBookingState, form: FormData): Promise<CoachingBookingState> {
  const { business, user, membership } = await requireWorkspace()
  if (business.id !== businessId) return { message: 'You switched businesses. Reopen the client in the correct business.' }
  if (!canManageClients(membership.role)) return { message: 'Only owners and administrators can book coaching sessions.' }
  if (![clientId, periodId, requestId].every((id) => uuid.safeParse(id).success)) return { message: 'This credit period could not be found.' }
  const parsed = choiceFields.safeParse({ coachId: text(form, 'coachId'), formatIndex: text(form, 'formatIndex'), day: text(form, 'day') })
  if (!parsed.success) return { message: 'Choose a session format, coach, and date.' }
  const choice = parsed.data
  const scope = { businessId, clientId, periodId, userId: user.id }
  const now = new Date()
  let result: { id: string; created: boolean } | undefined

  try {
    const db = adminDb()
    const context = await coachingAvailabilitySetup(db, scope, choice)
    if (choice.day < context.startsOn || choice.day >= context.endsOn || choice.day < businessDate(context.timezone, now)) {
      return { message: 'Choose a future date within this credit period.' }
    }
    const times = await availableCoachingStarts({ ...choice, ...context, clientId }, now)
    if (times.calendarUnavailable) return { message: 'This coach’s calendar is unavailable. Check their connection or choose another coach.' }
    const slots = times.starts.map((slot) => slot.toISOString())
    if (text(form, 'intent') === 'availability') return { selection: choice, slots, message: slots.length ? undefined : 'No times are open on this date. Try another date or coach.' }
    if (text(form, 'intent') !== 'book') return { message: 'Choose an available time.' }

    const input = bookingFields.safeParse({ startsAt: text(form, 'startsAt'), locationType: text(form, 'locationType'), locationDetail: text(form, 'locationDetail'),
      contact: text(form, 'contact'), noticeHours: text(form, 'noticeHours'), lateCancellation: text(form, 'lateCancellation') })
    if (!input.success) return { ...state, message: 'Choose a time and complete the meeting and cancellation details.' }
    const { startsAt, locationType, locationDetail, contact, noticeHours, lateCancellation } = input.data
    const start = new Date(startsAt)
    if (!slots.includes(start.toISOString())) return { ...state, slots, selection: choice, message: 'That time is no longer open. Choose a different time.' }
    if (locationType === 'video_link' && !isVideoUrl(locationDetail)) return { ...state, message: 'Enter a valid video meeting link.' }
    if (locationType !== 'zoom' && !locationDetail) return { ...state, message: 'Enter the meeting details.' }
    if (locationType === 'zoom' && (!isZoomConfigured || (await withoutZoom([choice.coachId])).length)) return { ...state, message: 'This coach needs to connect Zoom. Choose another meeting type or coach.' }

    result = await reserveCoachingSession(db, scope, { ...choice, id: requestId, startsAt: start, locationType,
      locationDetail: locationType === 'zoom' ? null : locationDetail, contact, noticeHours: noticeHours === '' ? null : noticeHours,
      lateCancellation: lateCancellation || null }, now)
  } catch (error) {
    if (conflict(error)) return { message: 'The coach or client already has a booking at that time. Check availability again.' }
    if (error instanceof CoachingSessionError) return { ...state, message: error.message }
    console.error('Coaching session booking failed', error instanceof Error ? error.name : 'unknown error')
    return { ...state, message: 'The session could not be booked. Try again.' }
  }

  if (result.created) {
    try {
      await afterConfirmed(result.id)
    } catch (error) {
      console.error('Coaching session confirmation failed', error instanceof Error ? error.name : 'unknown error')
    }
  }
  revalidatePath(`/app/clients/${clientId}`)
  revalidatePath('/app/bookings')
  redirect(`/app/bookings/coaching/${result.id}?status=booked`)
}

export interface CoachingOutcomeState { message?: string }

export async function saveCoachingOutcome(businessId: string, bookingId: string, _state: CoachingOutcomeState, form: FormData): Promise<CoachingOutcomeState> {
  const { user } = await requireWorkspace()
  if (![businessId, bookingId].every((id) => uuid.safeParse(id).success)) return { message: 'This coaching session could not be found.' }
  const intent = text(form, 'intent')
  if (intent !== 'attend' && intent !== 'cancel') return { message: 'Choose a session outcome.' }
  const by = text(form, 'by')
  if (intent === 'cancel' && by !== 'business' && by !== 'guest') return { message: 'Choose who cancelled the session.' }
  const expectedOutcome = text(form, 'expectedOutcome')
  if (intent === 'cancel' && expectedOutcome !== 'released' && expectedOutcome !== 'forfeited') return { message: 'Review the credit outcome before cancelling.' }
  let booking
  try {
    booking = await finishCoachingSession(adminDb(), { businessId, userId: user.id }, bookingId, intent === 'attend' ? { action: 'attend' } : {
      action: 'cancel', by: by === 'guest' ? 'guest' : 'business', expectedOutcome: expectedOutcome === 'forfeited' ? 'forfeited' : 'released',
    })
  } catch (error) {
    if (!(error instanceof CoachingSessionError)) console.error('Coaching session outcome failed', error instanceof Error ? error.name : 'unknown error')
    return { message: error instanceof CoachingSessionError ? error.message : 'The session outcome could not be saved.' }
  }
  if (intent === 'cancel') {
    try {
      await afterBookingCancelled(booking)
    } catch (error) {
      console.error('Coaching cancellation notification failed', error instanceof Error ? error.name : 'unknown error')
    }
  }
  revalidatePath(`/app/clients/${booking.coachingClientId}`)
  revalidatePath('/app/bookings')
  revalidatePath(`/app/bookings/coaching/${bookingId}`)
  redirect(`/app/bookings/coaching/${bookingId}?status=${intent === 'attend' ? 'attended' : 'cancelled'}`)
}
