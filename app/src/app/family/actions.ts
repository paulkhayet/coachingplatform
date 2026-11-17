'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { adminDb } from '@/db/server'
import { bookings } from '@/db/schema'
import { checkFeature } from '@/lib/billing/server'
import { afterBookingCancelled, afterBookingMoved, availableCoachingStarts, syncCoachingConfirmations } from '@/lib/booking/server'
import { businessDate } from '@/lib/clients/credits'
import {
  CoachingSessionError, FAMILY_MIN_NOTICE_HOURS, coachingMoveSetup, familyBookingContext, finishCoachingSession, moveCoachingSession, reserveCoachingSession,
} from '@/lib/clients/sessions'
import { familyLinks } from '@/lib/family/access'
import { getUser } from '@/lib/workspace'

// D-073 slices 2–3: parents and guardians book, move and cancel their student's sessions from the
// portal. Every change goes through the same session rules as staff, with the family's permission
// checked again inside each transaction.

const uuid = z.uuid()
const day = z.iso.date()

export interface FamilyTimesState {
  message?: string
  day?: string
  slots?: string[]
  /** The choice the times were found for, so booking uses the same one. */
  choice?: { periodId: string; formatIndex: number }
}

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const conflict = (error: unknown) => {
  const code = (error as { code?: string }).code ?? (error as { cause?: { code?: string } }).cause?.code
  return code === '23P01'
}

/** The signed-in guardian's access to a student, and a paid plan at the business. */
async function familyActor(clientId: string) {
  const user = await getUser()
  if (!user) redirect('/sign-in?next=/family')
  if (!uuid.safeParse(clientId).success) return { error: 'This student could not be found.' }
  const link = (await familyLinks(user.id)).find((l) => l.client_id === clientId)
  if (!link) return { error: 'You don’t have access to this student any more.' }
  const blocked = await checkFeature(link.business_id, 'clients')
  if (blocked) return { error: 'Booking from the portal isn’t available right now. Contact the coaching business.' }
  return { actor: { businessId: link.business_id, userId: user.id, family: true as const }, link }
}

/** The guardian's access to the student a session belongs to. */
async function sessionActor(bookingId: string) {
  if (!uuid.safeParse(bookingId).success) return { error: 'This session could not be found.' }
  const [booking] = await adminDb().select({ clientId: bookings.coachingClientId }).from(bookings).where(eq(bookings.id, bookingId))
  if (!booking?.clientId) return { error: 'This session could not be found.' }
  return familyActor(booking.clientId)
}

const soon = (now: Date) => now.getTime() + FAMILY_MIN_NOTICE_HOURS * 3_600_000

// ── Booking ──────────────────────────────────────────────────────────────────────────────────────────

const choiceFields = z.object({ periodId: uuid, formatIndex: z.string().regex(/^\d+$/).transform(Number), day })

/** Finds open times with the student's coach on a day, or books one of them. */
export async function familyBook(clientId: string, requestId: string, state: FamilyTimesState, form: FormData): Promise<FamilyTimesState> {
  const found = await familyActor(clientId)
  if ('error' in found) return { message: found.error }
  const { actor, link } = found
  const parsed = choiceFields.safeParse({ periodId: text(form, 'periodId'), formatIndex: text(form, 'formatIndex'), day: text(form, 'day') })
  if (!parsed.success) return { ...state, message: 'Choose what to book and a date.' }
  const { periodId, formatIndex } = parsed.data
  const db = adminDb()
  const now = new Date()
  let bookedId: string
  let coveredIds: string[]
  try {
    const context = await familyBookingContext(db, actor, clientId, now)
    if ('reason' in context) return { message: context.reason }
    const period = context.periods.find((p) => p.id === periodId)
    const format = period?.formats.find((f) => f.index === formatIndex)
    if (!period || !format) return { message: 'That isn’t available to book any more. Refresh the page.' }
    if (parsed.data.day < period.startsOn || parsed.data.day >= period.endsOn || parsed.data.day < businessDate(context.timezone, now)) {
      return { message: 'Choose a date within the package’s dates.' }
    }
    const times = await availableCoachingStarts({ clientId, coachId: context.coachId, durationMinutes: format.durationMinutes, day: parsed.data.day, endsOn: period.endsOn, timezone: context.timezone }, now)
    if (times.calendarUnavailable) return { message: 'The coach’s calendar can’t be checked right now. Try again later.' }
    const slots = times.starts.filter((s) => s.getTime() >= soon(now)).map((s) => s.toISOString())
    const choice = { periodId, formatIndex }
    if (text(form, 'intent') !== 'book') return { day: parsed.data.day, slots, choice, message: slots.length ? undefined : 'No times are open on this date. Try another day.' }
    const startsAt = text(form, 'startsAt')
    if (!slots.includes(startsAt)) return { day: parsed.data.day, slots, choice, message: 'That time was just taken. Choose another.' }
    const result = await reserveCoachingSession(db, { ...actor, clientId, periodId }, {
      id: requestId, coachId: context.coachId, formatIndex, locationType: context.locationType,
      locationDetail: context.locationType === 'zoom' ? null : context.locationDetail, contact: 'none',
      noticeHours: context.noticeHours, lateCancellation: context.lateCancellation, startsAt: new Date(startsAt),
    }, now)
    bookedId = result.id
    coveredIds = result.coveredIds
  } catch (error) {
    if (conflict(error)) return { ...state, message: 'That time was just taken. Choose another.' }
    if (error instanceof CoachingSessionError) return { ...state, message: error.message }
    console.error('Family booking failed', error instanceof Error ? error.message : 'unknown error')
    return { ...state, message: 'The session couldn’t be booked. Try again.' }
  }
  // Calendar invitation, Zoom link and confirmation emails, as for any covered session.
  if (coveredIds.length) await syncCoachingConfirmations(coveredIds)
  revalidatePath('/family')
  // Without "see sessions" the session page isn't theirs to open, so they land back home.
  redirect(link.can_view_sessions ? `/family/sessions/${bookedId}?status=booked` : '/family?status=booked')
}

// ── Moving and cancelling ────────────────────────────────────────────────────────────────────────────

/** Finds other open times for a session on a day, or moves it to one of them. */
export async function familyMove(bookingId: string, previousStart: string, state: FamilyTimesState, form: FormData): Promise<FamilyTimesState> {
  const found = await sessionActor(bookingId)
  if ('error' in found) return { message: found.error }
  const parsed = day.safeParse(text(form, 'day'))
  if (!parsed.success) return { ...state, message: 'Choose a date.' }
  const db = adminDb()
  const now = new Date()
  let moved
  try {
    const context = await coachingMoveSetup(db, found.actor, bookingId, now)
    if (context.booking.startsAt.getTime() !== new Date(previousStart).getTime()) return { message: 'This session changed. Refresh the page.' }
    if (parsed.data < context.startsOn || parsed.data >= context.endsOn || parsed.data < businessDate(context.timezone, now)) return { message: 'Choose a date within the package’s dates.' }
    const times = await availableCoachingStarts({ ...context, day: parsed.data, ignoreBookingId: bookingId }, now)
    if (times.calendarUnavailable) return { message: 'The coach’s calendar can’t be checked right now. Try again later.' }
    const slots = times.starts.filter((s) => s.getTime() >= soon(now) && s.getTime() !== context.booking.startsAt.getTime()).map((s) => s.toISOString())
    if (text(form, 'intent') !== 'move') return { day: parsed.data, slots, message: slots.length ? undefined : 'No other times are open on this date. Try another day.' }
    const startsAt = text(form, 'startsAt')
    if (!slots.includes(startsAt)) return { day: parsed.data, slots, message: 'That time was just taken. Choose another.' }
    moved = await moveCoachingSession(db, found.actor, bookingId, new Date(previousStart), new Date(startsAt), now)
  } catch (error) {
    if (conflict(error)) return { ...state, message: 'That time was just taken. Choose another.' }
    if (error instanceof CoachingSessionError) return { ...state, message: error.message }
    console.error('Family move failed', error instanceof Error ? error.message : 'unknown error')
    return { ...state, message: 'The session couldn’t be moved. Try again.' }
  }
  try { await afterBookingMoved(moved) } catch (error) {
    console.error('Family move notification failed', error instanceof Error ? error.message : 'unknown error')
  }
  if (moved.coveredIds.length) after(() => syncCoachingConfirmations(moved.coveredIds))
  revalidatePath('/family')
  redirect(`/family/sessions/${bookingId}?status=moved`)
}

export interface FamilyCancelState { message?: string }

/** Cancels a session as the family, under the package's late-cancellation rule shown beforehand. */
export async function familyCancel(bookingId: string, _state: FamilyCancelState, form: FormData): Promise<FamilyCancelState> {
  const found = await sessionActor(bookingId)
  if ('error' in found) return { message: found.error }
  const expected = text(form, 'expectedOutcome')
  if (expected !== 'released' && expected !== 'forfeited') return { message: 'Refresh the page and try again.' }
  let booking
  try {
    booking = await finishCoachingSession(adminDb(), found.actor, bookingId, { action: 'cancel', by: 'guest', expectedOutcome: expected })
  } catch (error) {
    if (error instanceof CoachingSessionError) return { message: error.message }
    console.error('Family cancellation failed', error instanceof Error ? error.message : 'unknown error')
    return { message: 'The session couldn’t be cancelled. Try again.' }
  }
  if (booking.coveredIds.length) after(() => syncCoachingConfirmations(booking.coveredIds))
  try { await afterBookingCancelled(booking) } catch (error) {
    console.error('Family cancellation notification failed', error instanceof Error ? error.message : 'unknown error')
  }
  revalidatePath('/family')
  redirect(`/family/sessions/${bookingId}?status=cancelled`)
}
