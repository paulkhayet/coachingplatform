import 'server-only'

import { and, eq, gt, inArray, lte, sql } from 'drizzle-orm'
import { adminDb, type AdminDb } from '@/db/server'
import {
  bookings, businesses, clientGuardians, coachingClients, inquiries, inquiryEvents, intakeSettings, memberships, profiles,
  type BookingAnswer, type Booking, type Inquiry, type InquiryEventKind, type MemberRole,
} from '@/db/schema'
import { firstCallCoachEmail, inquiryReceivedEmail, newInquiryEmail } from '@/lib/booking/emails'
import { businessLogoUrl } from '@/lib/business-logo'
import { sendEmail } from '@/lib/email/server'
import { siteUrl } from '@/lib/env'
import { canUseDashboard } from '@/lib/roles'
import { isOpenStage, isSelf, type FirstCallOutcome, type InquiryInput, type OpenStage } from './shared'

// Intake (D-074). Every change runs in one transaction that checks the person's role, so a stage move
// or conversion can't half-happen. Stage and assignment changes are written to the timeline by a
// database trigger; the transaction tells it who is acting.

type Tx = Parameters<Parameters<AdminDb['transaction']>[0]>[0]
type Actor = { businessId: string; userId: string }
type Member = { id: string; role: MemberRole }

export class IntakeError extends Error {}

export const MAX_INQUIRIES_PER_EMAIL_PER_HOUR = 3
export const MAX_INQUIRIES_PER_BUSINESS_PER_HOUR = 30

const pgCode = (error: unknown) => (error as { cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code
const pgMessage = (error: unknown) => (error as { cause?: { message?: string } }).cause?.message ?? (error as Error).message

/** Database rules (same-business staff, enrolment that can't be undone) raise 22023 with a message for people. */
function friendly(error: unknown): never {
  if (error instanceof IntakeError) throw error
  if (pgCode(error) === '22023') throw new IntakeError(pgMessage(error))
  if (pgCode(error) === '23P01') throw new IntakeError('That time was just taken. Choose another.')
  throw error
}

async function asStaff<T>(db: AdminDb, actor: Actor, fn: (tx: Tx, member: Member) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      // auth.uid() for this transaction only, so the timeline trigger records who made the change.
      await tx.execute(sql`select set_config('request.jwt.claim.sub', ${actor.userId}, true)`)
      const [member] = await tx.select({ id: memberships.id, role: memberships.role }).from(memberships)
        .where(and(eq(memberships.businessId, actor.businessId), eq(memberships.userId, actor.userId), eq(memberships.status, 'active'))).for('share')
      if (!member) throw new IntakeError('You no longer have access to this business.')
      return fn(tx, member)
    })
  } catch (error) {
    return friendly(error)
  }
}

function requireManager(member: Member) {
  if (!canUseDashboard(member.role)) throw new IntakeError('Only owners and administrators can change inquiries.')
}

async function locked(tx: Tx, actor: Actor, id: string) {
  const [inquiry] = await tx.select().from(inquiries).where(and(eq(inquiries.id, id), eq(inquiries.businessId, actor.businessId))).for('update')
  if (!inquiry) throw new IntakeError('This inquiry could not be found.')
  return inquiry
}

const log = (tx: Tx, inquiry: Pick<Inquiry, 'id' | 'businessId'>, actorId: string | null, kind: InquiryEventKind, data: Record<string, unknown> = {}) =>
  tx.insert(inquiryEvents).values({ businessId: inquiry.businessId, inquiryId: inquiry.id, actorId, kind, data })

const fields = (input: InquiryInput) => ({
  contactName: input.contactName, contactEmail: input.contactEmail.toLowerCase(), contactPhone: input.contactPhone || null,
  relationship: input.relationship || null, studentName: input.studentName, studentGrade: input.studentGrade || null,
  subjects: input.subjects, goals: input.goals || null, availabilityNotes: input.availabilityNotes || null, timezone: input.timezone || null,
})

// ── Creating ─────────────────────────────────────────────────────────────────────────────────────────

/** The business's public form, if it's switched on. */
export async function publicIntake(businessSlug: string, db: AdminDb = adminDb()) {
  const [row] = await db.select({
    business: { id: businesses.id, name: businesses.name, slug: businesses.slug, timezone: businesses.timezone, logoPath: businesses.logoPath, contactEmail: businesses.contactEmail },
    settings: intakeSettings,
  }).from(businesses).leftJoin(intakeSettings, eq(intakeSettings.businessId, businesses.id)).where(eq(businesses.slug, businessSlug)).limit(1)
  return row ?? null
}

/**
 * An inquiry from the public form. No account is involved, so this is the only gate: the form must be
 * on, and one email (or one business) can't be flooded. `limited` tells the family we already have it.
 */
export async function submitInquiry(db: AdminDb, businessId: string, input: InquiryInput, answers: BookingAnswer[]): Promise<{ id: string } | { limited: 'email' | 'business' } | { closed: true }> {
  const [settings] = await db.select({ enabled: intakeSettings.enabled }).from(intakeSettings).where(eq(intakeSettings.businessId, businessId))
  if (!settings?.enabled) return { closed: true }
  const recent = and(eq(inquiries.businessId, businessId), eq(inquiries.source, 'form'), gt(inquiries.createdAt, sql`now() - interval '1 hour'`))
  const [{ mine }] = await db.select({ mine: sql<number>`count(*)::int` }).from(inquiries).where(and(recent, eq(inquiries.contactEmail, input.contactEmail.toLowerCase())))
  if (mine >= MAX_INQUIRIES_PER_EMAIL_PER_HOUR) return { limited: 'email' }
  const [{ all }] = await db.select({ all: sql<number>`count(*)::int` }).from(inquiries).where(recent)
  if (all >= MAX_INQUIRIES_PER_BUSINESS_PER_HOUR) return { limited: 'business' }
  const [row] = await db.insert(inquiries).values({ businessId, source: 'form', answers, ...fields(input) }).returning({ id: inquiries.id })
  return row
}

/** Staff add an inquiry by hand, e.g. after a phone call. They become its owner. */
export async function addInquiry(db: AdminDb, actor: Actor, input: InquiryInput) {
  return asStaff(db, actor, async (tx, member) => {
    requireManager(member)
    const [row] = await tx.insert(inquiries).values({ businessId: actor.businessId, source: 'staff', ownerMembershipId: member.id, ...fields(input) }).returning({ id: inquiries.id })
    return row.id
  })
}

// ── Changing ─────────────────────────────────────────────────────────────────────────────────────────

export async function updateInquiry(db: AdminDb, actor: Actor, id: string, input: InquiryInput) {
  return asStaff(db, actor, async (tx, member) => {
    requireManager(member)
    await locked(tx, actor, id)
    await tx.update(inquiries).set(fields(input)).where(eq(inquiries.id, id))
  })
}

/** Moves an inquiry between the open stages, or closes it as lost. Enrolling goes through convertInquiry. */
export async function moveInquiry(db: AdminDb, actor: Actor, id: string, to: OpenStage | 'lost', opts: { lostReason?: string; clearCoach?: boolean } = {}) {
  return asStaff(db, actor, async (tx, member) => {
    requireManager(member)
    const inquiry = await locked(tx, actor, id)
    if (inquiry.stage === 'enrolled') throw new IntakeError('This inquiry is already enrolled as a client.')
    const lostReason = to === 'lost' ? opts.lostReason?.trim() : null
    if (to === 'lost' && !lostReason) throw new IntakeError('Choose why this inquiry was lost.')
    await tx.update(inquiries).set({ stage: to, lostReason, ...(opts.clearCoach ? { coachMembershipId: null } : {}) }).where(eq(inquiries.id, id))
  })
}

/**
 * Sets who handles the inquiry and which coach is proposed (undefined leaves one as it is). Choosing a
 * coach for a brand-new inquiry starts the matching stage. Returns the coach if it changed, for the email.
 */
export async function assignInquiry(db: AdminDb, actor: Actor, id: string, change: { ownerId?: string | null; coachId?: string | null }) {
  return asStaff(db, actor, async (tx, member) => {
    requireManager(member)
    const inquiry = await locked(tx, actor, id)
    if (inquiry.stage === 'enrolled' || inquiry.stage === 'lost') throw new IntakeError('This inquiry is closed. Reopen it to change who it’s assigned to.')
    const coachChanged = change.coachId !== undefined && change.coachId !== inquiry.coachMembershipId
    await tx.update(inquiries).set({
      ...(change.ownerId !== undefined ? { ownerMembershipId: change.ownerId } : {}),
      ...(change.coachId !== undefined ? { coachMembershipId: change.coachId } : {}),
      ...(coachChanged && change.coachId && inquiry.stage === 'new' ? { stage: 'matching' as const } : {}),
    }).where(eq(inquiries.id, id))
    return { newCoachId: coachChanged ? change.coachId ?? null : null }
  })
}

export async function setNextAction(db: AdminDb, actor: Actor, id: string, nextAction: string | null, nextActionDue: string | null) {
  return asStaff(db, actor, async (tx, member) => {
    requireManager(member)
    await locked(tx, actor, id)
    await tx.update(inquiries).set({ nextAction, nextActionDue }).where(eq(inquiries.id, id))
  })
}

/** Owners and administrators, or the proposed coach on their own inquiry. */
function requireParticipant(member: Member, inquiry: Inquiry) {
  if (!canUseDashboard(member.role) && inquiry.coachMembershipId !== member.id) throw new IntakeError('You can only add to inquiries you’re the proposed coach for.')
}

export async function addInquiryNote(db: AdminDb, actor: Actor, id: string, text: string) {
  return asStaff(db, actor, async (tx, member) => {
    const inquiry = await locked(tx, actor, id)
    requireParticipant(member, inquiry)
    await log(tx, inquiry, actor.userId, 'note', { text })
  })
}

export async function recordFirstCallOutcome(db: AdminDb, actor: Actor, id: string, outcome: FirstCallOutcome, note: string | null) {
  return asStaff(db, actor, async (tx, member) => {
    const inquiry = await locked(tx, actor, id)
    requireParticipant(member, inquiry)
    if (!inquiry.firstCallBookingId) throw new IntakeError('Book the first call before recording how it went.')
    await log(tx, inquiry, actor.userId, 'first_call_outcome', { outcome, ...(note ? { note } : {}), bookingId: inquiry.firstCallBookingId })
  })
}

// ── First call ───────────────────────────────────────────────────────────────────────────────────────

export interface FirstCallInput {
  startsAt: Date
  durationMinutes: number
  locationType: Booking['locationType']
  locationDetail: string | null
}

/** What's needed to offer first-call times: the inquiry, its proposed coach, and any call already booked. */
export async function firstCallSetup(db: AdminDb, actor: Actor, id: string) {
  return asStaff(db, actor, async (tx, member) => {
    requireManager(member)
    const [inquiry] = await tx.select().from(inquiries).where(and(eq(inquiries.id, id), eq(inquiries.businessId, actor.businessId)))
    if (!inquiry) throw new IntakeError('This inquiry could not be found.')
    return { inquiry, ...(await firstCallChecks(tx, inquiry, new Date())) }
  })
}

async function firstCallChecks(tx: Tx, inquiry: Inquiry, now: Date) {
  if (!isOpenStage(inquiry.stage)) throw new IntakeError('This inquiry is closed. Reopen it to book a call.')
  if (!inquiry.coachMembershipId) throw new IntakeError('Choose a coach before booking the first call.')
  const [host] = await tx.select({ userId: memberships.userId }).from(memberships)
    .where(and(eq(memberships.id, inquiry.coachMembershipId), eq(memberships.businessId, inquiry.businessId), eq(memberships.status, 'active'), eq(memberships.coaches, true)))
  if (!host) throw new IntakeError('The proposed coach is no longer available. Choose another coach.')
  if (inquiry.firstCallBookingId) {
    const [existing] = await tx.select({ status: bookings.status, endsAt: bookings.endsAt }).from(bookings).where(eq(bookings.id, inquiry.firstCallBookingId))
    if (existing?.status === 'confirmed' && existing.endsAt > now) throw new IntakeError('A first call is already booked. Cancel it in Bookings before booking another.')
  }
  return { coachId: inquiry.coachMembershipId, hostUserId: host.userId }
}

/**
 * Books the first call as a guest booking with the proposed coach: no page, no client, no charge. The
 * caller has already checked the coach's calendar; the database still refuses a double-booking. Returns
 * the booking, whose calendar event and emails the caller sends once this has committed.
 */
export async function reserveFirstCall(db: AdminDb, actor: Actor, id: string, input: FirstCallInput, now = new Date()) {
  return asStaff(db, actor, async (tx, member) => {
    requireManager(member)
    const inquiry = await locked(tx, actor, id)
    const { coachId, hostUserId } = await firstCallChecks(tx, inquiry, now)
    if (input.startsAt <= now) throw new IntakeError('Choose a time in the future.')
    // Free up times held by guests who never finished paying, so they don't block this call.
    await tx.update(bookings).set({ status: 'expired' }).where(and(eq(bookings.hostUserId, hostUserId), eq(bookings.status, 'pending_payment'), lte(bookings.holdExpiresAt, now)))
    const answers: BookingAnswer[] = [{ questionId: 'student', label: 'Student', value: inquiry.studentName }]
    if (inquiry.studentGrade) answers.push({ questionId: 'grade', label: 'Grade', value: inquiry.studentGrade })
    if (inquiry.subjects.length) answers.push({ questionId: 'subjects', label: 'Subjects', value: inquiry.subjects })
    if (inquiry.goals) answers.push({ questionId: 'goals', label: 'Goals', value: inquiry.goals })
    const [booking] = await tx.insert(bookings).values({
      businessId: inquiry.businessId, hostMembershipId: coachId, hostUserId, title: 'First call',
      startsAt: input.startsAt, endsAt: new Date(input.startsAt.getTime() + input.durationMinutes * 60_000),
      status: 'confirmed', paymentStatus: 'not_required', guestName: inquiry.contactName, guestEmail: inquiry.contactEmail,
      guestTimezone: inquiry.timezone, answers, locationType: input.locationType, locationDetail: input.locationDetail, inquiryId: inquiry.id,
    }).returning({ id: bookings.id })
    await tx.update(inquiries).set({ firstCallBookingId: booking.id, ...(inquiry.stage === 'new' || inquiry.stage === 'matching' ? { stage: 'first_call' as const } : {}) }).where(eq(inquiries.id, id))
    await log(tx, inquiry, actor.userId, 'first_call_booked', { bookingId: booking.id, startsAt: input.startsAt.toISOString(), coachId })
    return booking.id
  })
}

// ── Enrolling ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Turns an inquiry into a client: the client record (with the proposed coach, if they still coach here),
 * the family contact as a guardian unless the student wrote in themself, and the inquiry linked and
 * closed as enrolled. One transaction; a second attempt finds it already enrolled.
 */
export async function convertInquiry(db: AdminDb, actor: Actor, id: string) {
  return asStaff(db, actor, async (tx, member) => {
    requireManager(member)
    const inquiry = await locked(tx, actor, id)
    if (inquiry.stage === 'enrolled' || inquiry.clientId) throw new IntakeError('This inquiry is already enrolled as a client.')
    if (inquiry.stage === 'lost') throw new IntakeError('This inquiry is closed. Reopen it before enrolling.')
    const [coach] = inquiry.coachMembershipId
      ? await tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.id, inquiry.coachMembershipId), eq(memberships.status, 'active'), eq(memberships.coaches, true)))
      : []
    const self = isSelf(inquiry.relationship)
    const [client] = await tx.insert(coachingClients).values({
      businessId: inquiry.businessId, name: inquiry.studentName, email: self ? inquiry.contactEmail : null, coachMembershipId: coach?.id ?? null,
    }).returning({ id: coachingClients.id })
    if (!self) {
      await tx.insert(clientGuardians).values({
        businessId: inquiry.businessId, clientId: client.id, name: (inquiry.contactName.trim().length >= 2 ? inquiry.contactName.trim() : `${inquiry.contactName.trim()} (contact)`).slice(0, 100),
        relationship: inquiry.relationship, email: inquiry.contactEmail, phone: inquiry.contactPhone,
      })
    }
    await tx.update(inquiries).set({ clientId: client.id, stage: 'enrolled', nextAction: null, nextActionDue: null }).where(eq(inquiries.id, id))
    await log(tx, inquiry, actor.userId, 'converted', { clientId: client.id })
    return client.id
  })
}

// ── Emails ───────────────────────────────────────────────────────────────────────────────────────────

const inquiryUrl = (id: string) => `${siteUrl}/app/dashboard/intake/${id}`

/** After a form submission: thank the family, and tell the people who handle intake. Never throws. */
export async function notifyNewInquiry(inquiryId: string, db: AdminDb = adminDb()) {
  try {
    const [row] = await db.select({ inquiry: inquiries, businessName: businesses.name, logoPath: businesses.logoPath, contactEmail: businesses.contactEmail, notify: intakeSettings.notifyMembershipIds })
      .from(inquiries).innerJoin(businesses, eq(businesses.id, inquiries.businessId)).leftJoin(intakeSettings, eq(intakeSettings.businessId, inquiries.businessId))
      .where(eq(inquiries.id, inquiryId))
    if (!row) return
    const { inquiry } = row
    const staff = await db.select({ id: memberships.id, email: profiles.email }).from(memberships).innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(and(eq(memberships.businessId, inquiry.businessId), eq(memberships.status, 'active'), inArray(memberships.role, ['owner', 'admin'])))
    const chosen = row.notify?.length ? staff.filter((s) => row.notify!.includes(s.id)) : staff
    await sendEmail(inquiry.contactEmail, inquiryReceivedEmail({ businessName: row.businessName, logoUrl: businessLogoUrl(row.logoPath), contactName: inquiry.contactName, studentName: inquiry.studentName, self: isSelf(inquiry.relationship) }),
      { replyTo: row.contactEmail ?? staff[0]?.email, idempotencyKey: `inquiry-received:${inquiry.id}` })
    const message = newInquiryEmail({ businessName: row.businessName, contactName: inquiry.contactName, contactEmail: inquiry.contactEmail, studentName: inquiry.studentName, subjects: inquiry.subjects, goals: inquiry.goals, url: inquiryUrl(inquiry.id) })
    // If the chosen people have all left, fall back to every owner and administrator rather than nobody.
    for (const s of chosen.length ? chosen : staff) {
      if (s.email) await sendEmail(s.email, message, { replyTo: inquiry.contactEmail, idempotencyKey: `inquiry-new:${inquiry.id}:${s.id}` })
    }
  } catch (error) {
    console.error('Inquiry emails failed', error)
  }
}

/** Tells a coach they've been proposed for a family. Never throws. */
export async function notifyProposedCoach(inquiryId: string, coachMembershipId: string, assigner: { userId: string; name: string }, db: AdminDb = adminDb()) {
  try {
    const [row] = await db.select({ inquiry: inquiries, businessName: businesses.name, coachUser: memberships.userId, coachEmail: profiles.email })
      .from(inquiries).innerJoin(businesses, eq(businesses.id, inquiries.businessId))
      .innerJoin(memberships, eq(memberships.id, inquiries.coachMembershipId)).innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(and(eq(inquiries.id, inquiryId), eq(inquiries.coachMembershipId, coachMembershipId)))
    // No email when people assign themselves.
    if (!row?.coachEmail || row.coachUser === assigner.userId) return
    await sendEmail(row.coachEmail, firstCallCoachEmail({ businessName: row.businessName, assignerName: assigner.name, studentName: row.inquiry.studentName, subjects: row.inquiry.subjects, url: inquiryUrl(inquiryId) }),
      { idempotencyKey: `inquiry-coach:${inquiryId}:${coachMembershipId}:${row.inquiry.updatedAt.getTime()}` })
  } catch (error) {
    console.error('Coach assignment email failed', error)
  }
}
