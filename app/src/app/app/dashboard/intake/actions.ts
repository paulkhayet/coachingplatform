'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'
import { adminDb } from '@/db/server'
import { afterConfirmed, availableMemberStarts } from '@/lib/booking/server'
import { checkFeature } from '@/lib/billing/server'
import { businessDate } from '@/lib/clients/credits'
import {
  IntakeError, addInquiry, addInquiryNote, assignInquiry, convertInquiry, firstCallSetup, moveInquiry, notifyProposedCoach, recordFirstCallOutcome,
  reserveFirstCall, setNextAction, updateInquiry,
} from '@/lib/intake/server'
import { FIRST_CALL_MINUTES, FIRST_CALL_OUTCOMES, INQUIRY_FIELDS, OPEN_STAGES, checkInquiry } from '@/lib/intake/shared'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import { isZoomConfigured, withoutZoom } from '@/lib/zoom/server'
import { actionAccess } from '../guard'

const intakePath = '/app/dashboard/intake'
const uuid = z.uuid()

export interface IntakeState {
  message?: string
  /** A short confirmation shown next to the form. */
  done?: string
  errors?: FieldErrors
  values?: Record<string, string>
}

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function failed(error: unknown, fallback: string): IntakeState {
  if (error instanceof IntakeError) return { message: error.message }
  console.error(fallback, error instanceof Error ? error.message : 'unknown error')
  return { message: fallback }
}

function refresh(id?: string) {
  revalidatePath(intakePath)
  revalidatePath('/app/dashboard')
  revalidatePath('/app/dashboard/assignments')
  if (id) revalidatePath(`${intakePath}/${id}`)
}

function readInquiry(form: FormData) {
  const values = Object.fromEntries(INQUIRY_FIELDS.map((k) => [k, text(form, k)]))
  return { values, parsed: checkInquiry(values) }
}

/** Staff add an inquiry by hand (e.g. after a phone call) or correct one's details. */
export async function saveInquiry(businessId: string, inquiryId: string | null, _state: IntakeState, form: FormData): Promise<IntakeState> {
  const access = await actionAccess(businessId, 'manager')
  if (!access.ok) return { message: access.message }
  if (inquiryId !== null && !uuid.safeParse(inquiryId).success) return { message: 'This inquiry could not be found.' }
  const { values, parsed } = readInquiry(form)
  if ('errors' in parsed) return { errors: parsed.errors, values }
  let id = inquiryId
  try {
    if (id) await updateInquiry(adminDb(), access.actor, id, parsed.data)
    else id = await addInquiry(adminDb(), access.actor, parsed.data)
  } catch (error) {
    return { ...failed(error, 'The inquiry could not be saved. Try again.'), values }
  }
  refresh(id)
  if (inquiryId) return { done: 'Saved.' }
  redirect(`${intakePath}/${id}`)
}

const stageFields = z.object({ stage: z.enum([...OPEN_STAGES, 'lost']), lostReason: z.string().max(300), rematch: z.boolean() })

/** Moves an inquiry to another stage, closes it as lost (with a reason), or sends it back for a new coach. */
export async function moveStage(businessId: string, inquiryId: string, _state: IntakeState, form: FormData): Promise<IntakeState> {
  const access = await actionAccess(businessId, 'manager')
  if (!access.ok) return { message: access.message }
  const other = text(form, 'lostReasonOther')
  const reason = text(form, 'lostReason')
  const parsed = stageFields.safeParse({ stage: text(form, 'stage'), lostReason: reason === 'Other' && other ? other : reason, rematch: text(form, 'rematch') === 'yes' })
  if (!uuid.safeParse(inquiryId).success || !parsed.success) return { message: 'Choose a stage.' }
  try {
    await moveInquiry(adminDb(), access.actor, inquiryId, parsed.data.stage, { lostReason: parsed.data.lostReason, clearCoach: parsed.data.rematch })
  } catch (error) {
    return failed(error, 'The stage could not be changed. Try again.')
  }
  refresh(inquiryId)
  return { done: 'Moved.' }
}

const optionalMember = z.union([z.literal(''), uuid])

/** Sets who handles the inquiry and which coach is proposed. A newly proposed coach gets an email. */
export async function assignStaff(businessId: string, inquiryId: string, _state: IntakeState, form: FormData): Promise<IntakeState> {
  const access = await actionAccess(businessId, 'manager')
  if (!access.ok) return { message: access.message }
  const change: { ownerId?: string | null; coachId?: string | null } = {}
  for (const [field, key] of [['ownerId', 'ownerId'], ['coachId', 'coachId']] as const) {
    if (!form.has(field)) continue
    const parsed = optionalMember.safeParse(text(form, field))
    if (!parsed.success) return { message: 'Choose someone from the list.' }
    change[key] = parsed.data || null
  }
  if (!uuid.safeParse(inquiryId).success) return { message: 'This inquiry could not be found.' }
  try {
    const { newCoachId } = await assignInquiry(adminDb(), access.actor, inquiryId, change)
    if (newCoachId) after(() => notifyProposedCoach(inquiryId, newCoachId, { userId: access.access.user.id, name: access.access.user.fullName }))
  } catch (error) {
    return failed(error, 'The assignment could not be saved. Try again.')
  }
  refresh(inquiryId)
  return { done: 'Saved.' }
}

const nextFields = z.object({ nextAction: z.string().max(200, 'Use at most 200 characters'), nextActionDue: z.union([z.literal(''), z.iso.date('Choose a valid date')]) })

export async function saveNextAction(businessId: string, inquiryId: string, _state: IntakeState, form: FormData): Promise<IntakeState> {
  const access = await actionAccess(businessId, 'manager')
  if (!access.ok) return { message: access.message }
  const parsed = nextFields.safeParse({ nextAction: text(form, 'nextAction'), nextActionDue: text(form, 'nextActionDue') })
  if (!uuid.safeParse(inquiryId).success) return { message: 'This inquiry could not be found.' }
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  if (parsed.data.nextActionDue && !parsed.data.nextAction) return { errors: { nextAction: 'Say what needs to happen by then' } }
  try {
    await setNextAction(adminDb(), access.actor, inquiryId, parsed.data.nextAction || null, parsed.data.nextActionDue || null)
  } catch (error) {
    return failed(error, 'The next step could not be saved. Try again.')
  }
  refresh(inquiryId)
  return { done: 'Saved.' }
}

/** A note on the timeline. Owners and administrators, or the proposed coach on their own inquiry. */
export async function addNote(businessId: string, inquiryId: string, _state: IntakeState, form: FormData): Promise<IntakeState> {
  const access = await actionAccess(businessId, 'member')
  if (!access.ok) return { message: access.message }
  const note = z.string().min(1, 'Write a note first').max(2000, 'Keep notes under 2,000 characters').safeParse(text(form, 'note'))
  if (!uuid.safeParse(inquiryId).success) return { message: 'This inquiry could not be found.' }
  if (!note.success) return { errors: { note: note.error.issues[0].message } }
  try {
    await addInquiryNote(adminDb(), access.actor, inquiryId, note.data)
  } catch (error) {
    return failed(error, 'The note could not be saved. Try again.')
  }
  refresh(inquiryId)
  return { done: 'Note added.' }
}

const outcomeFields = z.object({ outcome: z.enum(FIRST_CALL_OUTCOMES.map((o) => o.value) as [string, ...string[]]), note: z.string().max(2000) })

/** How the first call went. Recorded by the coach who took it, or by an owner or administrator. */
export async function saveFirstCallOutcome(businessId: string, inquiryId: string, _state: IntakeState, form: FormData): Promise<IntakeState> {
  const access = await actionAccess(businessId, 'member')
  if (!access.ok) return { message: access.message }
  const parsed = outcomeFields.safeParse({ outcome: text(form, 'outcome'), note: text(form, 'note') })
  if (!uuid.safeParse(inquiryId).success || !parsed.success) return { message: 'Choose how the call went.' }
  try {
    await recordFirstCallOutcome(adminDb(), access.actor, inquiryId, parsed.data.outcome as (typeof FIRST_CALL_OUTCOMES)[number]['value'], parsed.data.note || null)
  } catch (error) {
    return failed(error, 'The outcome could not be saved. Try again.')
  }
  refresh(inquiryId)
  return { done: 'Recorded.' }
}

export interface FirstCallState {
  message?: string
  day?: string
  durationMinutes?: number
  slots?: string[]
}

const callChoice = z.object({ day: z.iso.date(), durationMinutes: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().refine((n) => (FIRST_CALL_MINUTES as readonly number[]).includes(n))) })
const callFields = z.object({ startsAt: z.iso.datetime({ offset: true }), locationType: z.enum(['video_link', 'phone', 'in_person', 'zoom']), locationDetail: z.string().max(500) })

function isUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

/**
 * Finds the proposed coach's open times on a day, then books the first call: a guest booking with the
 * family's contact, on the coach's calendar, with the usual confirmation emails.
 */
export async function bookFirstCall(businessId: string, inquiryId: string, state: FirstCallState, form: FormData): Promise<FirstCallState> {
  const access = await actionAccess(businessId, 'manager')
  if (!access.ok) return { message: access.message }
  if (!uuid.safeParse(inquiryId).success) return { message: 'This inquiry could not be found.' }
  const choice = callChoice.safeParse({ day: text(form, 'day'), durationMinutes: text(form, 'durationMinutes') })
  if (!choice.success) return { message: 'Choose a date and a length for the call.' }
  const { day, durationMinutes } = choice.data
  const { business } = access.access
  const now = new Date()
  if (day < businessDate(business.timezone, now)) return { message: 'Choose today or a later date.' }
  let bookingId: string
  try {
    const db = adminDb()
    const setup = await firstCallSetup(db, access.actor, inquiryId)
    const times = await availableMemberStarts({ coachId: setup.coachId, durationMinutes, day, timezone: business.timezone }, now)
    if (times.calendarUnavailable) return { message: 'This coach’s calendar is unavailable. Check their connection or choose another coach.' }
    const slots = times.starts.map((s) => s.toISOString())
    if (text(form, 'intent') !== 'book') return { day, durationMinutes, slots, message: slots.length ? undefined : 'No times are open on this date. Try another date.' }

    const input = callFields.safeParse({ startsAt: text(form, 'startsAt'), locationType: text(form, 'locationType'), locationDetail: text(form, 'locationDetail') })
    if (!input.success) return { ...state, slots, message: 'Choose an open time and how you’ll meet.' }
    const { locationType, locationDetail } = input.data
    const startsAt = new Date(input.data.startsAt)
    if (!times.starts.some((s) => s.getTime() === startsAt.getTime())) return { day, durationMinutes, slots, message: 'That time is no longer open. Choose a different time.' }
    if (locationType === 'video_link' && !isUrl(locationDetail)) return { ...state, slots, message: 'Enter a valid video meeting link.' }
    if (locationType !== 'zoom' && !locationDetail) return { ...state, slots, message: 'Enter the meeting details.' }
    if (locationType === 'zoom') {
      const blocked = await checkFeature(business.id, 'zoom')
      if (blocked) return { ...state, slots, message: blocked }
      if (!isZoomConfigured || (await withoutZoom([setup.coachId])).length) return { ...state, slots, message: 'This coach needs to connect Zoom. Choose another way to meet.' }
    }
    bookingId = await reserveFirstCall(db, access.actor, inquiryId, { startsAt, durationMinutes, locationType, locationDetail: locationType === 'zoom' ? null : locationDetail }, now)
  } catch (error) {
    if (error instanceof IntakeError) return { ...state, message: error.message }
    console.error('Booking the first call failed', error instanceof Error ? error.message : 'unknown error')
    return { ...state, message: 'The call could not be booked. Try again.' }
  }
  // Zoom link, calendar event and emails to the family and the coach.
  await afterConfirmed(bookingId)
  refresh(inquiryId)
  revalidatePath('/app/bookings')
  redirect(`${intakePath}/${inquiryId}?status=call-booked`)
}

/** Creates the client (and the family contact as a guardian) and opens the client's page. */
export async function convertToClient(businessId: string, inquiryId: string, _state: IntakeState, _form: FormData): Promise<IntakeState> {
  const access = await actionAccess(businessId, 'manager')
  if (!access.ok) return { message: access.message }
  if (!uuid.safeParse(inquiryId).success) return { message: 'This inquiry could not be found.' }
  // Clients are a paid-plan feature; the Team plan includes them, but keep the check in one place.
  const blocked = await checkFeature(access.access.business.id, 'clients')
  if (blocked) return { message: blocked }
  let clientId: string
  try {
    clientId = await convertInquiry(adminDb(), access.actor, inquiryId)
  } catch (error) {
    return failed(error, 'The client could not be created. Try again.')
  }
  refresh(inquiryId)
  revalidatePath('/app/clients')
  redirect(`/app/clients/${clientId}?status=enrolled`)
}
