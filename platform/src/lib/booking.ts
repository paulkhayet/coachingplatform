import { addDays, addMinutes, setHours, setMinutes, startOfDay } from 'date-fns'
import type { DB, ID, Appointment, Staff, EventType } from './types'
import { purchaseBalance, isCanceled, round2 } from './credits'

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd

/** Coaches eligible for a student: assigned coach plus the student's pool (D-012/D-017). */
export function eligibleCoaches(db: DB, studentId: ID): Staff[] {
  const s = db.students.find((x) => x.id === studentId)
  if (!s) return []
  const ids = new Set<ID>()
  if (s.assignedCoachId) ids.add(s.assignedCoachId)
  if (s.poolId) db.pools.find((p) => p.id === s.poolId)?.coachIds.forEach((id) => ids.add(id))
  return db.staff.filter((st) => ids.has(st.id) && st.status === 'active')
}

export function coachBusy(db: DB, coachId: ID, start: Date, minutes: number, ignoreId?: ID, bufferMinutes?: number) {
  const buffer = (bufferMinutes ?? db.business.policies.bufferMinutes) * 60000
  const s = start.getTime()
  const e = s + minutes * 60000
  const appt = db.appointments.find(
    (a) => a.id !== ignoreId && a.coachId === coachId && !isCanceled(a) && overlaps(s - buffer, e + buffer, new Date(a.start).getTime(), new Date(a.start).getTime() + a.minutes * 60000),
  )
  if (appt) return 'Overlaps another appointment'
  const block = db.calendarBlocks.find((b) => b.coachId === coachId && overlaps(s, e, new Date(b.start).getTime(), new Date(b.end).getTime()))
  if (block) return 'Busy on Google Calendar'
  return null
}

export function withinAvailability(db: DB, coachId: ID, start: Date, minutes: number) {
  const coach = db.staff.find((s) => s.id === coachId)
  if (!coach) return false
  const end = addMinutes(start, minutes)
  return coach.availability.some((w) => {
    if (w.weekday !== start.getDay()) return false
    const [sh, sm] = w.start.split(':').map(Number)
    const [eh, em] = w.end.split(':').map(Number)
    const ws = setMinutes(setHours(startOfDay(start), sh), sm)
    const we = setMinutes(setHours(startOfDay(start), eh), em)
    return start >= ws && end <= we
  })
}

export function slotsForDay(db: DB, coachId: ID, day: Date, minutes: number, now = new Date(), opts?: { ignoreNotice?: boolean; minNoticeHours?: number; windowDays?: number; bufferMinutes?: number; ignoreId?: ID }) {
  const coach = db.staff.find((s) => s.id === coachId)
  // A stale calendar connection means unknown time is never offered as free (P-20).
  if (!coach || !coach.calendarHealthy) return []
  const p = db.business.policies
  const out: Date[] = []
  for (const w of coach.availability.filter((x) => x.weekday === day.getDay())) {
    const [sh, sm] = w.start.split(':').map(Number)
    const [eh, em] = w.end.split(':').map(Number)
    let t = setMinutes(setHours(startOfDay(day), sh), sm)
    const end = setMinutes(setHours(startOfDay(day), eh), em)
    while (addMinutes(t, minutes) <= end) {
      const okNotice = opts?.ignoreNotice ? t > now : t.getTime() - now.getTime() >= (opts?.minNoticeHours ?? p.minNoticeHours) * 3600000
      const okWindow = t.getTime() - now.getTime() <= (opts?.windowDays ?? p.bookingWindowDays) * 86400000
      if (okNotice && okWindow && !coachBusy(db, coachId, t, minutes, opts?.ignoreId, opts?.bufferMinutes)) out.push(t)
      t = addMinutes(t, 30)
    }
  }
  return out
}

export function nextDays(n: number, from = new Date()) {
  return Array.from({ length: n }, (_, i) => addDays(startOfDay(from), i))
}

export interface BookingInput {
  studentId: ID
  coachId: ID
  sessionTypeId: ID
  purchaseId: ID
  start: Date
  actorKind: 'staff' | 'family'
}

export interface Check {
  ok: boolean
  label: string
  detail?: string
}

export interface BookingResult {
  ok: boolean
  checks: Check[]
  funded: boolean
  isMakeup: boolean
  credits: number
}

/** Recheck availability, permissions, remaining entitlement and funding together before committing (P-10). */
export function validateBooking(db: DB, input: BookingInput, extraReserved = 0, extraFunded = 0, now = new Date()): BookingResult {
  const p = db.business.policies
  const st = db.sessionTypes.find((s) => s.id === input.sessionTypeId)!
  const purchase = db.purchases.find((x) => x.id === input.purchaseId)
  const checks: Check[] = []
  const cost = st.credits

  const coachOk = eligibleCoaches(db, input.studentId).some((c) => c.id === input.coachId)
  checks.push({ ok: coachOk, label: 'Coach is eligible for this client', detail: coachOk ? undefined : 'Only the assigned coach or pool coaches can be booked.' })

  const avail = withinAvailability(db, input.coachId, input.start, st.minutes)
  const busy = coachBusy(db, input.coachId, input.start, st.minutes)
  checks.push({ ok: avail && !busy, label: 'Time is available', detail: !avail ? 'Outside the coach’s availability.' : busy ?? undefined })

  const notice = input.start.getTime() - now.getTime() >= (input.actorKind === 'family' ? p.minNoticeHours * 3600000 : 0)
  checks.push({ ok: notice && input.start > now, label: 'Booking notice met', detail: notice ? undefined : `Families must book at least ${p.minNoticeHours} hours ahead.` })

  if (!purchase) {
    checks.push({ ok: false, label: 'Paid coaching purchase', detail: 'This client has no active purchase.' })
    return { ok: false, checks, funded: false, isMakeup: false, credits: cost }
  }
  const typeOk = purchase.sessionTypeIds.includes(st.id)
  checks.push({ ok: typeOk, label: 'Session type included in agreement', detail: typeOk ? undefined : 'Not part of the accepted agreement.' })

  const bal = purchaseBalance(db, purchase.id, now)
  const afterEnd = input.start > new Date(purchase.endDate)
  let isMakeup = false
  if (afterEnd && purchase.kind === 'fixed') {
    const mk = bal.makeup
    const okMk = !!mk && mk.available - extraReserved >= cost - 1e-9 && input.start <= mk.deadline
    isMakeup = true
    checks.push({ ok: okMk, label: 'Eligible makeup after program end', detail: okMk ? `Uses a preserved makeup credit (deadline ${mk!.deadline.toLocaleDateString()})` : 'No eligible makeup credit for a date after the program end.' })
  } else {
    const remaining = round2(bal.remainingEntitlement - extraReserved)
    checks.push({ ok: remaining >= cost - 1e-9, label: 'Purchased entitlement remains', detail: `${Math.max(0, remaining)} of ${bal.purchased} credits unreserved · this session costs ${cost}` })
  }
  const freeFunded = round2(bal.usableFunded - extraFunded)
  const funded = freeFunded >= cost - 1e-9
  if (p.bookingMode === 'funded_only') {
    checks.push({ ok: funded, label: 'Funded by payments received', detail: funded ? undefined : 'This business only allows booking against paid credits.' })
  } else {
    checks.push({ ok: true, label: funded ? 'Funded by payments received' : 'Advance reservation (awaiting payment)', detail: funded ? undefined : p.autoCancelUnpaid ? `Must be funded ${p.unpaidCutoffHours}h before the session or it is released automatically.` : 'Coaching cannot be delivered until it is funded.' })
  }
  return { ok: checks.every((c) => c.ok), checks, funded, isMakeup, credits: cost }
}

export function previewSeries(db: DB, input: BookingInput, weeks: number, now = new Date()) {
  let reserved = 0
  let fundedUsed = 0
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(input.start, i * 7)
    const r = validateBooking(db, { ...input, start }, reserved, fundedUsed, now)
    if (r.ok) {
      reserved += r.credits
      if (r.funded) fundedUsed += r.credits
    }
    return { start, ...r }
  })
}

export interface CancelPreview {
  status: Appointment['status']
  timely: boolean
  hoursNotice: number
  outcome: string
  creditEffect: string
}

export function cancelPreview(a: Appointment, by: 'family' | 'business', now = new Date()): CancelPreview {
  const hours = (new Date(a.start).getTime() - now.getTime()) / 3600000
  if (by === 'business') return { status: 'canceled_business', timely: true, hoursNotice: hours, outcome: 'Business cancellation — no penalty to the client', creditEffect: `${a.credits} credit${a.credits === 1 ? '' : 's'} returned and eligible for a makeup` }
  if (hours >= a.policy.noticeHours) return { status: 'canceled_timely', timely: true, hoursNotice: hours, outcome: `Cancelled with ${Math.floor(hours)} hours' notice (policy: ${a.policy.noticeHours}h)`, creditEffect: `${a.credits} credit${a.credits === 1 ? '' : 's'} returned and eligible for a makeup` }
  return {
    status: 'canceled_late',
    timely: false,
    hoursNotice: hours,
    outcome: `Late cancellation — less than ${a.policy.noticeHours} hours' notice`,
    creditEffect: a.policy.lateOutcome === 'forfeit' ? `${a.credits} credit${a.credits === 1 ? '' : 's'} will be used under the cancellation policy` : `${a.credits} credit${a.credits === 1 ? '' : 's'} preserved under this business’s policy`,
  }
}

export interface ReminderPlan {
  channel: 'email' | 'sms'
  at: Date
  to: string
  state: 'scheduled' | 'sent' | 'suppressed' | 'skipped'
  reason?: string
}

/** Reminder schedule for an appointment version (P-12). */
export function reminderPlan(db: DB, a: Appointment, now = new Date()): ReminderPlan[] {
  const p = db.business.policies
  const start = new Date(a.start)
  const created = new Date(a.createdAt)
  const recipients: { name: string; sms: boolean; phone?: string }[] = []
  if (a.studentId) {
    const s = db.students.find((x) => x.id === a.studentId)!
    if (s.email || s.independent) recipients.push({ name: s.name, sms: s.smsOptIn, phone: s.phone })
    for (const link of s.guardians) {
      const g = db.guardians.find((x) => x.id === link.guardianId)!
      if (link.canBook || link.payer) recipients.push({ name: g.name, sms: g.smsOptIn, phone: g.phone })
    }
  } else if (a.inquiryId) {
    const inq = db.inquiries.find((i) => i.id === a.inquiryId)
    if (inq) recipients.push({ name: inq.guardianName, sms: false })
  }
  const out: ReminderPlan[] = []
  const state = (at: Date): Pick<ReminderPlan, 'state' | 'reason'> => {
    if (isCanceled(a)) return { state: 'suppressed', reason: 'Appointment cancelled' }
    if (at < created) return { state: 'skipped', reason: 'Booked after this reminder time' }
    return at <= now ? { state: 'sent' } : { state: 'scheduled' }
  }
  for (const h of p.emailReminderHours) {
    const at = new Date(start.getTime() - h * 3600000)
    for (const r of recipients) out.push({ channel: 'email', at, to: r.name, ...state(at) })
  }
  if (p.smsEnabled) {
    const at = new Date(start.getTime() - p.smsReminderHours * 3600000)
    for (const r of recipients) {
      if (!r.sms || !r.phone) {
        out.push({ channel: 'sms', at, to: r.name, state: 'skipped', reason: 'Not opted in to SMS' })
        continue
      }
      const hour = at.getHours()
      if (p.smsQuietHours && (hour < 8 || hour >= 20)) out.push({ channel: 'sms', at, to: r.name, state: 'suppressed', reason: 'Quiet hours (8 a.m.–8 p.m.) — email still sent' })
      else out.push({ channel: 'sms', at, to: r.name, ...state(at) })
    }
  }
  return out.sort((x, y) => x.at.getTime() - y.at.getTime())
}

/** Open times for a booking page. With "any available", each time is offered once and assigned to the
 *  eligible host with the fewest upcoming bookings (simple round robin). */
export function eventSlots(db: DB, et: EventType, day: Date, hostId: ID | null, now = new Date(), ignoreId?: ID): { start: Date; hostId: ID }[] {
  const hosts = (hostId ? [hostId] : et.hostIds).filter((id) => db.staff.some((s) => s.id === id && s.status === 'active'))
  const load = (id: ID) => db.appointments.filter((a) => a.coachId === id && a.status === 'scheduled' && new Date(a.start) > now).length
  const byTime = new Map<number, ID>()
  for (const h of [...hosts].sort((a, b) => load(a) - load(b))) {
    for (const t of slotsForDay(db, h, day, et.minutes, now, { minNoticeHours: et.minNoticeHours, windowDays: et.bookingWindowDays, bufferMinutes: et.bufferMinutes, ignoreId })) {
      if (!byTime.has(t.getTime())) byTime.set(t.getTime(), h)
    }
  }
  return [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([t, h]) => ({ start: new Date(t), hostId: h }))
}
