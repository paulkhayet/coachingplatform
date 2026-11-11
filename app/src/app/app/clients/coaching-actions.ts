'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'
import { adminDb } from '@/db/server'
import { afterBookingCancelled, afterBookingMoved, availableCoachingDates, availableCoachingStarts, syncCoachingConfirmations } from '@/lib/booking/server'
import { coachingAvailabilitySetup, coachingMoveSetup, CoachingSessionError, finishCoachingSession, moveCoachingSession, reserveCoachingSeries, reserveCoachingSession } from '@/lib/clients/sessions'
import { businessDate, unpaidDeadline } from '@/lib/clients/credits'
import { MAX_WEEKLY_SESSIONS } from '@/lib/clients/session-policy'
import { insideCreditPeriod, weeklyCoachingDates } from '@/lib/clients/weekly-sessions'
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
  singleNeedsPayment?: boolean
  selection?: { coachId: string; formatIndex: number; day: string }
  preview?: WeeklyPreview
}

export type WeeklyPreview = {
  key: string; anchor: string; count: number; creditUnits: number; fundedSlots: number; reservableSlots: number;
  dates: { start: string; issue: string | null; needsCoverageNow: boolean }[];
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

async function previewDates(input: { first: Date; count: number; clientId: string; coachId: string; now: Date;
  durationMinutes: number; timezone: string; startsOn: string; endsOn: string; creditUnits: number;
  availableUnits: number; reservableUnits: number; cutoffHours: number | null }): Promise<WeeklyPreview> {
  const dates = weeklyCoachingDates(input.first, input.count, input.timezone).map(({ startsAt, sameLocalTime }) => ({
    startsAt,
    issue: !sameLocalTime ? 'Local time unavailable' : startsAt <= input.now ? 'Time has passed' :
      !insideCreditPeriod(startsAt, input.durationMinutes, input) ? 'Outside credit period' : null,
  }))
  const open = await availableCoachingDates(input, dates.filter((date) => !date.issue).map((date) => date.startsAt), input.now)
  const available = new Set(open.starts.map((date) => date.getTime()))
  return {
    key: randomUUID(), anchor: input.first.toISOString(), count: input.count, creditUnits: input.creditUnits,
    fundedSlots: Math.floor(input.availableUnits / input.creditUnits),
    reservableSlots: Math.floor(input.reservableUnits / input.creditUnits),
    dates: dates.map((date) => ({
      start: date.startsAt.toISOString(), needsCoverageNow: input.cutoffHours !== null && unpaidDeadline(date.startsAt, input.cutoffHours) <= input.now,
      issue: date.issue ?? (available.has(date.startsAt.getTime()) ? null : open.calendarUnavailable ? 'Calendar unavailable' : 'Time conflicts'),
    })),
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
  const intent = text(form, 'intent')
  const series = intent === 'book-series'
  let result: { ids: string[]; coveredIds: string[] }

  try {
    const db = adminDb()
    const context = await coachingAvailabilitySetup(db, scope, choice)
    if (choice.day < context.startsOn || choice.day >= context.endsOn || choice.day < businessDate(context.timezone, now)) {
      return { message: 'Choose a future date within this credit period.' }
    }
    if (intent === 'availability') {
      const times = await availableCoachingStarts({ ...choice, ...context, clientId }, now)
      if (times.calendarUnavailable) return { message: 'This coach’s calendar is unavailable. Check their connection or choose another coach.' }
      if (context.reservableUnits < context.creditUnits) return { message: 'There are not enough credits available for this format.' }
      const singleNeedsPayment = context.availableUnits < context.creditUnits
      const cutoff = singleNeedsPayment ? context.cutoffHours : null
      const slots = times.starts.filter((slot) => cutoff === null || unpaidDeadline(slot, cutoff) > now).map((slot) => slot.toISOString())
      const message = slots.length ? undefined : times.starts.length ? 'Open times on this date are inside the payment cutoff. Choose a later date or record a payment.' : 'No times are open on this date. Try another date or coach.'
      return { selection: choice, slots, singleNeedsPayment, message }
    }
    const anchor = z.iso.datetime({ offset: true }).safeParse(text(form, 'startsAt'))
    if (!anchor.success) return { ...state, message: 'Choose an open time first.' }
    const first = new Date(anchor.data)
    if (businessDate(context.timezone, first) !== choice.day) return { message: 'Find times for the selected date again.' }
    let starts = [first]
    if (series || intent === 'preview') {
      const count = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(2).max(MAX_WEEKLY_SESSIONS)).safeParse(text(form, 'repeatCount'))
      if (!count.success) return { ...state, message: `Choose between 2 and ${MAX_WEEKLY_SESSIONS} weekly dates.` }
      const preview = await previewDates({ ...context, coachId: choice.coachId, clientId, first, count: count.data, now })
      if (intent === 'preview') return { ...state, selection: choice, preview, message: undefined }
      const selected = new Set(form.getAll('selectedStarts').filter((value): value is string => typeof value === 'string'))
      starts = preview.dates.filter((date) => !date.issue && selected.has(date.start)).map((date) => new Date(date.start))
      if (!selected.size || starts.length !== selected.size || starts.length > preview.reservableSlots) {
        return { ...state, preview, message: 'Review the current availability and credit balance before selecting dates.' }
      }
    } else if (intent === 'book') {
      const times = await availableCoachingStarts({ ...choice, ...context, clientId }, now)
      if (times.calendarUnavailable) return { message: 'This coach’s calendar is unavailable. Check their connection or choose another coach.' }
      if (!times.starts.some((date) => date.getTime() === first.getTime())) return { ...state, slots: times.starts.map((date) => date.toISOString()), selection: choice, message: 'That time is no longer open. Choose a different time.' }
    } else return { message: 'Choose an available time.' }

    const input = bookingFields.safeParse({ startsAt: text(form, 'startsAt'), locationType: text(form, 'locationType'), locationDetail: text(form, 'locationDetail'),
      contact: text(form, 'contact'), noticeHours: text(form, 'noticeHours'), lateCancellation: text(form, 'lateCancellation') })
    if (!input.success) return { ...state, message: 'Choose a time and complete the meeting and cancellation details.' }
    const { locationType, locationDetail, contact, noticeHours, lateCancellation } = input.data
    if (locationType === 'video_link' && !isVideoUrl(locationDetail)) return { ...state, message: 'Enter a valid video meeting link.' }
    if (locationType !== 'zoom' && !locationDetail) return { ...state, message: 'Enter the meeting details.' }
    if (locationType === 'zoom' && (!isZoomConfigured || (await withoutZoom([choice.coachId])).length)) return { ...state, message: 'This coach needs to connect Zoom. Choose another meeting type or coach.' }

    const details = { ...choice, id: requestId, locationType,
      locationDetail: locationType === 'zoom' ? null : locationDetail, contact, noticeHours: noticeHours === '' ? null : noticeHours,
      lateCancellation: lateCancellation || null }
    if (series) result = await reserveCoachingSeries(db, scope, { ...details, starts }, now)
    else {
      const booking = await reserveCoachingSession(db, scope, { ...details, startsAt: first }, now)
      result = { ids: [booking.id], coveredIds: booking.coveredIds }
    }
  } catch (error) {
    if (conflict(error)) return { message: 'The coach or client already has a booking at that time. Check availability again.' }
    if (error instanceof CoachingSessionError) return { ...state, message: error.message }
    console.error('Coaching session booking failed', error instanceof Error ? error.name : 'unknown error')
    return { ...state, message: 'The session could not be booked. Try again.' }
  }

  if (result.coveredIds.length) {
    if (series) after(() => syncCoachingConfirmations(result.coveredIds))
    else await syncCoachingConfirmations(result.coveredIds)
  }
  revalidatePath(`/app/clients/${clientId}`)
  revalidatePath('/app/bookings')
  redirect(series ? `/app/clients/${clientId}?status=series` : `/app/bookings/coaching/${result.ids[0]}?status=booked`)
}

export interface CoachingMoveState { message?: string; day?: string; slots?: string[] }

export async function moveCoachingAction(businessId: string, bookingId: string, previousStart: string, state: CoachingMoveState, form: FormData): Promise<CoachingMoveState> {
  const { user } = await requireWorkspace()
  if (![businessId, bookingId].every((id) => uuid.safeParse(id).success)) return { message: 'This coaching session could not be found.' }
  const day = z.iso.date().safeParse(text(form, 'day'))
  if (!day.success) return { message: 'Choose a date.' }
  const now = new Date()
  const actor = { businessId, userId: user.id }
  let moved
  try {
    const db = adminDb()
    const context = await coachingMoveSetup(db, actor, bookingId, now)
    if (context.booking.startsAt.getTime() !== new Date(previousStart).getTime()) return { message: 'This session changed. Refresh the page before moving it.' }
    if (day.data < context.startsOn || day.data >= context.endsOn || day.data < businessDate(context.timezone, now)) return { message: 'Choose a future date within this credit period.' }
    const times = await availableCoachingStarts({ ...context, day: day.data, ignoreBookingId: bookingId }, now)
    if (times.calendarUnavailable) return { message: 'This coach’s calendar is unavailable. Check the connection and try again.' }
    const cutoff = context.booking.creditCoveredAt ? null : context.booking.unpaidCancellationHours
    const slots = times.starts.filter((date) => date.getTime() !== context.booking.startsAt.getTime() &&
      (cutoff === null || unpaidDeadline(date, cutoff) > now)).map((date) => date.toISOString())
    if (text(form, 'intent') === 'availability') return { day: day.data, slots, message: slots.length ? undefined : 'No other times are open on this date.' }
    const startsAt = text(form, 'startsAt')
    if (text(form, 'intent') !== 'move' || !slots.includes(startsAt)) return { day: day.data, slots, message: 'Choose a time that is still open.' }
    moved = await moveCoachingSession(db, actor, bookingId, new Date(previousStart), new Date(startsAt), now)
  } catch (error) {
    if (conflict(error)) return { message: 'The coach or client was just booked at that time. Check open times again.' }
    if (error instanceof CoachingSessionError) return { ...state, message: error.message }
    console.error('Coaching move failed', error instanceof Error ? error.name : 'unknown error')
    return { ...state, message: 'The session could not be moved. Try again.' }
  }
  try { await afterBookingMoved(moved) } catch (error) {
    console.error('Coaching move notification failed', error instanceof Error ? error.name : 'unknown error')
  }
  if (moved.coveredIds.length) after(() => syncCoachingConfirmations(moved.coveredIds))
  revalidatePath('/app/bookings')
  revalidatePath(`/app/clients/${moved.coachingClientId}`)
  revalidatePath(`/app/bookings/coaching/${bookingId}`)
  redirect(`/app/bookings/coaching/${bookingId}?status=moved`)
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
    if (booking.coveredIds.length) after(() => syncCoachingConfirmations(booking.coveredIds))
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
