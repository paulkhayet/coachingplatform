import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays } from 'date-fns'
import type {
  DB, Viewer, ID, Inquiry, OfferOption, Appointment, Staff, Policies, IntegrationKey, PlanId, Offering, Student, GuardianLink, Purchase, Installment, Availability, Homework, EventType, Answer,
} from './types'
import { buildSeed, DB_VERSION } from './seed'
import { uid, money } from './format'
import { validateBooking, cancelPreview, eventSlots, type BookingInput } from './booking'
import { apptCoverage, purchaseBalance } from './credits'
import { draftFollowUp, plannedDeliveries } from './followups'
import { planById } from './plans'

type Result<T = undefined> = { ok: true; value?: T; message?: string } | { ok: false; error: string }

interface State {
  db: DB
  viewer: Viewer
  setViewer: (v: Viewer) => void
  reset: () => void
  act: <T = undefined>(fn: (db: DB) => Result<T>) => Result<T>
}

const now = () => new Date().toISOString()

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      db: buildSeed(),
      viewer: { kind: 'staff', id: 'st_eleni' },
      setViewer: (viewer) => set({ viewer }),
      reset: () => set({ db: buildSeed() }),
      act: (fn) => {
        const db = structuredClone(get().db)
        const r = fn(db)
        if (r.ok) set({ db })
        return r
      },
    }),
    {
      name: 'schedulefast-demo',
      version: DB_VERSION,
      partialize: (s) => ({ db: s.db, viewer: s.viewer }) as unknown as State,
      migrate: () => ({ db: buildSeed(), viewer: { kind: 'staff', id: 'st_eleni' } }) as unknown as State,
    },
  ),
)

export const useDB = () => useStore((s) => s.db)
export const useViewer = () => useStore((s) => s.viewer)

export function useStaffViewer(): Staff | null {
  const db = useDB()
  const v = useViewer()
  return v.kind === 'staff' ? db.staff.find((s) => s.id === v.id) ?? null : null
}

// ---------- helpers used by actions ----------
function audit(db: DB, actor: string, action: string, detail: string) {
  db.audit.unshift({ id: uid('a'), at: now(), actor, action, detail })
}
function notify(db: DB, channel: 'email' | 'sms', to: string, subject: string, status: 'sent' | 'delivered' | 'suppressed' | 'failed' = 'sent', reason?: string) {
  db.notifications.unshift({ id: uid('n'), at: now(), channel, to, subject, status, reason })
}
function task(db: DB, t: Omit<DB['tasks'][number], 'id' | 'createdAt' | 'status'>) {
  db.tasks.unshift({ ...t, id: uid('t'), createdAt: now(), status: 'open' })
}
const nameOf = (db: DB, staffId: ID) => db.staff.find((s) => s.id === staffId)?.name ?? 'Someone'
function familyContacts(db: DB, studentId: ID, filter: (l: GuardianLink) => boolean = () => true) {
  const s = db.students.find((x) => x.id === studentId)!
  const gs = s.guardians.filter(filter).map((l) => db.guardians.find((g) => g.id === l.guardianId)!.name)
  return [...(s.email ? [s.name] : []), ...gs]
}
function meetingFor(db: DB, type: Appointment['meeting']['type']): Appointment['meeting'] {
  if (type === 'zoom') {
    return db.business.integrations.zoom.status === 'connected'
      ? { type, url: `https://zoom.us/j/8${Math.floor(Math.random() * 1e9)}`, status: 'ready' }
      : { type, status: 'error' }
  }
  if (type === 'in_person') return { type, location: 'Willow Coaching studio, 214 Elm St', status: 'ready' }
  return { type, status: 'pending' }
}
/** Refund a paid booking-page call when it is cancelled in time (or by the business). Returns a summary. */
function settleGuestPayment(db: DB, a: Appointment, force: boolean): string | null {
  if (!a.payment || a.payment.status !== 'paid') return null
  const et = db.eventTypes.find((e) => e.id === a.eventTypeId)
  const hours = (new Date(a.start).getTime() - Date.now()) / 3600000
  if (force || !et || hours >= et.refundCutoffHours) {
    a.payment.status = 'refunded'
    a.payment.refundedAt = now()
    if (a.guest) notify(db, 'email', a.guest.name, `Refund issued — ${money(a.payment.amountCents)}`, 'delivered')
    audit(db, 'Stripe', 'Refund issued', `${a.guest?.name ?? 'Guest'} · ${money(a.payment.amountCents)}`)
    return `${money(a.payment.amountCents)} refunded via Stripe`
  }
  a.payment.status = 'kept'
  return `No refund — cancelled less than ${et.refundCutoffHours}h before`
}

function responsibleAdmin(db: DB) {
  return db.staff.find((s) => s.role === 'admin' && s.status === 'active') ?? db.staff.find((s) => s.role === 'owner')!
}

// ---------- actions ----------
export const actions = {
  submitInquiry(data: Pick<Inquiry, 'studentName' | 'grade' | 'school' | 'guardianName' | 'guardianEmail' | 'studentEmail' | 'independent' | 'goals' | 'availability' | 'source'>) {
    return useStore.getState().act<ID>((db) => {
      const team = db.business.policies.workflow === 'team'
      const responsible = team ? responsibleAdmin(db) : db.staff.find((s) => s.role === 'owner')!
      const inq: Inquiry = { ...data, id: uid('inq'), createdAt: now(), stage: 'new', responsibleId: responsible.id }
      db.inquiries.unshift(inq)
      task(db, { title: `Review inquiry from ${data.independent ? data.studentName : data.guardianName}`, detail: `${data.studentName} · ${data.grade}. ${team ? 'Match a coach and book a fit call.' : 'Book a fit call.'}`, assigneeId: responsible.id, kind: 'handoff', link: `/app/inquiries?open=${inq.id}` })
      notify(db, 'email', data.independent ? data.studentName : data.guardianName, `We received your inquiry — ${db.business.name}`, 'delivered')
      audit(db, data.guardianName || data.studentName, 'Submitted inquiry', data.studentName)
      return { ok: true, value: inq.id }
    })
  },

  saveEventType(et: EventType, actorId: ID) {
    return useStore.getState().act((db) => {
      if (!et.name.trim()) return { ok: false, error: 'Name the booking page.' }
      if (!/^[a-z0-9-]+$/.test(et.slug)) return { ok: false, error: 'The link can use lowercase letters, numbers and dashes only.' }
      if (db.eventTypes.some((x) => x.slug === et.slug && x.id !== et.id)) return { ok: false, error: 'Another booking page already uses that link.' }
      if (!et.hostIds.length) return { ok: false, error: 'Choose at least one host.' }
      if (et.questions.some((q) => !q.label.trim())) return { ok: false, error: 'Every question needs a label.' }
      if (et.questions.some((q) => (q.type === 'single' || q.type === 'multi') && q.options.filter((o) => o.trim()).length < 2)) return { ok: false, error: 'Choice questions need at least two options.' }
      if (et.priceCents > 0 && db.business.integrations.stripe.status !== 'connected') return { ok: false, error: 'Connect Stripe before charging for calls.' }
      const clean = { ...et, questions: et.questions.map((q) => ({ ...q, options: q.options.filter((o) => o.trim()) })) }
      const i = db.eventTypes.findIndex((x) => x.id === et.id)
      if (i >= 0) db.eventTypes[i] = clean
      else db.eventTypes.push(clean)
      audit(db, nameOf(db, actorId), i >= 0 ? 'Updated booking page' : 'Created booking page', `${et.name}${et.priceCents ? ` · ${money(et.priceCents)}` : ' · free'}`)
      return { ok: true }
    })
  },

  deleteEventType(id: ID, actorId: ID) {
    return useStore.getState().act((db) => {
      const et = db.eventTypes.find((x) => x.id === id)!
      if (db.appointments.some((a) => a.eventTypeId === id && a.status === 'scheduled' && new Date(a.start) > new Date())) return { ok: false, error: 'This page has upcoming bookings. Turn it off instead so existing bookings stay intact.' }
      db.eventTypes = db.eventTypes.filter((x) => x.id !== id)
      audit(db, nameOf(db, actorId), 'Deleted booking page', et.name)
      return { ok: true }
    })
  },

  /** A guest books a call from a public booking page. Payment (if any) is a simulated Stripe Checkout. */
  guestBook(input: { eventTypeId: ID; hostId: ID; start: Date; guest: { name: string; email: string; phone?: string }; student?: { name: string; grade: string; independent: boolean }; answers: Answer[]; outcome: 'success' | 'decline' }) {
    return useStore.getState().act<string>((db) => {
      const et = db.eventTypes.find((e) => e.id === input.eventTypeId)
      if (!et || !et.active) return { ok: false, error: 'This booking page is no longer available.' }
      const free = eventSlots(db, et, input.start, input.hostId).some((s) => s.start.getTime() === input.start.getTime())
      if (!free) return { ok: false, error: 'That time was just taken. Please pick another.' }
      if (et.priceCents > 0 && input.outcome === 'decline') return { ok: false, error: 'Your card was declined. No booking was made and you weren’t charged.' }
      const studentName = input.student?.name || input.guest.name
      const goals = input.answers.find((a) => et.questions.find((q) => q.id === a.questionId)?.type === 'textarea')?.value ?? input.answers.map((a) => a.value).join(' · ')
      const heard = input.answers.find((a) => /hear/i.test(a.label))?.value
      // Reuse an open inquiry for the same email instead of duplicating the family's history.
      let inq = db.inquiries.find((i) => i.guardianEmail.toLowerCase() === input.guest.email.toLowerCase() && !['enrolled', 'declined'].includes(i.stage))
      if (!inq) {
        inq = {
          id: uid('inq'), studentName, grade: input.student?.grade || '—', school: '', guardianName: input.guest.name, guardianEmail: input.guest.email, guardianPhone: input.guest.phone,
          independent: input.student?.independent ?? false, goals, availability: 'Booked online', source: heard ?? `Booking page: ${et.name}`, createdAt: now(), stage: 'consult_scheduled', responsibleId: input.hostId,
        }
        db.inquiries.unshift(inq)
      }
      inq.stage = 'consult_scheduled'
      inq.matchedCoachId = input.hostId
      inq.eventTypeId = et.id
      inq.answers = input.answers
      const token = `${studentName.toLowerCase().replace(/[^a-z]+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`
      const a: Appointment = {
        id: uid('ap'), studentId: null, inquiryId: inq.id, kind: 'consultation', coachId: input.hostId, sessionTypeId: 'stype_fit', purchaseId: null, start: input.start.toISOString(), minutes: et.minutes, credits: 0,
        status: 'scheduled', meeting: et.location === 'phone' ? { type: 'phone', location: input.guest.phone ? `We’ll call ${input.guest.phone}` : 'Phone call', status: 'ready' } : meetingFor(db, et.location),
        policy: { noticeHours: et.refundCutoffHours, lateOutcome: 'preserve', noShowOutcome: 'preserve' }, createdAt: now(), createdBy: `${input.guest.name} (guest)`,
        eventTypeId: et.id, guest: input.guest, answers: input.answers, manageToken: token,
        payment: et.priceCents > 0 ? { amountCents: et.priceCents, status: 'paid', ref: `pi_${Math.random().toString(36).slice(2, 12)}`, paidAt: now() } : undefined,
      }
      db.appointments.push(a)
      notify(db, 'email', input.guest.name, `Confirmed: ${et.name} with ${nameOf(db, input.hostId)}${et.priceCents ? ` · receipt ${money(et.priceCents)}` : ''}`, 'delivered')
      notify(db, 'email', nameOf(db, input.hostId), `New booking: ${et.name} with ${input.guest.name}`, 'delivered')
      task(db, { title: `${et.name} with ${studentName}`, detail: `Booked online for ${new Date(a.start).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Questionnaire answers are on the booking.`, assigneeId: input.hostId, kind: 'handoff', link: `/app/sessions/${a.id}` })
      audit(db, `${input.guest.name} (guest)`, 'Booked online', `${et.name}${et.priceCents ? ` · paid ${money(et.priceCents)}` : ''}`)
      return { ok: true, value: token }
    })
  },

  guestCancel(token: string, reason: string) {
    return useStore.getState().act((db) => {
      const a = db.appointments.find((x) => x.manageToken === token)
      if (!a || a.status !== 'scheduled') return { ok: false, error: 'This booking can no longer be changed.' }
      a.status = 'canceled_timely'
      a.canceledAt = now()
      a.canceledBy = `${a.guest?.name ?? 'Guest'} (guest)`
      a.cancelReason = reason || 'Cancelled by guest'
      const refund = settleGuestPayment(db, a, false)
      const inq = db.inquiries.find((i) => i.id === a.inquiryId)
      if (inq && inq.stage === 'consult_scheduled') inq.stage = 'waiting'
      notify(db, 'email', nameOf(db, a.coachId), `Cancelled: ${a.guest?.name}’s booking`, 'delivered')
      audit(db, a.canceledBy, 'Cancelled booking', `${reason || 'No reason given'}${refund ? ` · ${refund}` : ''}`)
      return { ok: true, message: refund ?? 'Booking cancelled' }
    })
  },

  guestReschedule(token: string, start: Date, hostId: ID) {
    return useStore.getState().act((db) => {
      const a = db.appointments.find((x) => x.manageToken === token)
      if (!a || a.status !== 'scheduled') return { ok: false, error: 'This booking can no longer be changed.' }
      const et = db.eventTypes.find((e) => e.id === a.eventTypeId)!
      if (!eventSlots(db, et, start, hostId, new Date(), a.id).some((s) => s.start.getTime() === start.getTime())) return { ok: false, error: 'That time was just taken. Please pick another.' }
      const from = a.start
      a.start = start.toISOString()
      a.coachId = hostId
      a.createdAt = now()
      notify(db, 'email', a.guest?.name ?? 'Guest', `Rescheduled: ${et.name}`, 'delivered')
      notify(db, 'email', nameOf(db, hostId), `Rescheduled: ${a.guest?.name}’s ${et.name}`, 'delivered')
      audit(db, `${a.guest?.name ?? 'Guest'} (guest)`, 'Rescheduled booking', `${new Date(from).toLocaleString()} → ${start.toLocaleString()}`)
      return { ok: true, message: 'Rescheduled. Updated confirmation sent.' }
    })
  },

  matchCoach(inquiryId: ID, coachId: ID, note: string, actorId: ID) {
    return useStore.getState().act((db) => {
      const inq = db.inquiries.find((i) => i.id === inquiryId)!
      inq.matchedCoachId = coachId
      inq.handoffNote = note || undefined
      inq.stage = 'matching'
      db.tasks.filter((t) => t.link?.includes(inquiryId) && t.assigneeId === actorId && t.title.startsWith('Match')).forEach((t) => (t.status = 'done'))
      task(db, { title: `New match: ${inq.studentName}`, detail: note ? `Handoff note: ${note}` : 'Book a fit call with the family.', assigneeId: coachId, kind: 'handoff', link: `/app/inquiries?open=${inquiryId}` })
      audit(db, nameOf(db, actorId), 'Matched coach', `${inq.studentName} → ${nameOf(db, coachId)}`)
      return { ok: true, message: `Matched with ${nameOf(db, coachId)}` }
    })
  },

  bookConsult(inquiryId: ID, coachId: ID, start: Date, actor: string) {
    return useStore.getState().act((db) => {
      const inq = db.inquiries.find((i) => i.id === inquiryId)!
      const a: Appointment = {
        id: uid('ap'), studentId: null, inquiryId, kind: 'consultation', coachId, sessionTypeId: 'stype_fit', purchaseId: null, start: start.toISOString(), minutes: 20, credits: 0, status: 'scheduled',
        meeting: meetingFor(db, 'zoom'), policy: { noticeHours: 0, lateOutcome: 'preserve', noShowOutcome: 'preserve' }, createdAt: now(), createdBy: actor,
      }
      db.appointments.push(a)
      inq.consultApptId = a.id
      inq.matchedCoachId = coachId
      inq.stage = 'consult_scheduled'
      notify(db, 'email', inq.independent ? inq.studentName : inq.guardianName, `Your free fit call with ${nameOf(db, coachId)} is confirmed`, 'delivered')
      audit(db, actor, 'Booked fit call', `${inq.studentName} with ${nameOf(db, coachId)}`)
      return { ok: true }
    })
  },

  recordFit(inquiryId: ID, outcome: 'fit' | 'not_fit' | 'follow_up', notes: string, actorId: ID) {
    return useStore.getState().act((db) => {
      const inq = db.inquiries.find((i) => i.id === inquiryId)!
      inq.fitOutcome = outcome
      inq.fitNotes = notes
      inq.stage = outcome === 'fit' ? 'consult_done' : outcome === 'not_fit' ? 'declined' : 'waiting'
      const consult = db.appointments.find((a) => a.id === inq.consultApptId)
      if (consult && consult.status === 'scheduled') consult.status = 'attended'
      db.tasks.filter((t) => t.link?.includes(inquiryId) && t.assigneeId === actorId).forEach((t) => (t.status = 'done'))
      if (outcome === 'fit') {
        const admin = db.business.policies.workflow === 'team' ? responsibleAdmin(db) : db.staff.find((s) => s.role === 'owner')!
        inq.responsibleId = admin.id
        if (admin.id !== actorId) task(db, { title: `Send an offer to the ${inq.guardianName.split(' ').slice(-1)[0]} family`, detail: `${nameOf(db, actorId)} reported a fit for ${inq.studentName}.`, assigneeId: admin.id, kind: 'handoff', link: `/app/inquiries?open=${inquiryId}` })
      }
      audit(db, nameOf(db, actorId), 'Recorded consultation outcome', `${inq.studentName}: ${outcome.replace('_', ' ')}`)
      return { ok: true }
    })
  },

  setInquiryStage(inquiryId: ID, stage: Inquiry['stage'], actorId: ID) {
    return useStore.getState().act((db) => {
      const inq = db.inquiries.find((i) => i.id === inquiryId)!
      inq.stage = stage
      audit(db, nameOf(db, actorId), 'Updated inquiry', `${inq.studentName}: ${stage}`)
      return { ok: true }
    })
  },

  sendOffer(inquiryId: ID, options: OfferOption[], actorId: ID) {
    return useStore.getState().act<string>((db) => {
      const inq = db.inquiries.find((i) => i.id === inquiryId)!
      if (!options.length) return { ok: false, error: 'Choose at least one option.' }
      const p = db.business.policies
      const prev = db.offers.find((o) => o.id === inq.offerId)
      if (prev && prev.status === 'sent') prev.status = 'voided'
      const token = `${inq.studentName.toLowerCase().replace(/[^a-z]+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`
      const offer = {
        id: uid('offer'), token, inquiryId, coachId: inq.matchedCoachId ?? db.staff.find((s) => s.role === 'owner')!.id, options, status: 'sent' as const, version: (prev?.version ?? 0) + 1,
        policy: { cancelNoticeHours: p.cancelNoticeHours, lateCancelOutcome: p.lateCancelOutcome, makeupWindowDays: p.makeupWindowDays }, sentAt: now(), expiresAt: addDays(new Date(), 14).toISOString(), createdBy: actorId,
      }
      db.offers.push(offer)
      inq.offerId = offer.id
      inq.stage = 'offer_sent'
      db.tasks.filter((t) => t.link?.includes(inquiryId) && t.title.startsWith('Send an offer')).forEach((t) => (t.status = 'done'))
      notify(db, 'email', inq.independent ? inq.studentName : inq.guardianName, `Your coaching offer from ${db.business.name}`, 'delivered')
      audit(db, nameOf(db, actorId), prev ? `Sent offer version ${offer.version}` : 'Sent offer', `${inq.studentName} · ${options.length} option${options.length > 1 ? 's' : ''}`)
      return { ok: true, value: token }
    })
  },

  guestSelect(offerId: ID, index: number) {
    return useStore.getState().act((db) => {
      const o = db.offers.find((x) => x.id === offerId)!
      if (o.status !== 'sent' && o.status !== 'accepted') return { ok: false, error: 'This offer can no longer be changed.' }
      if (index < 0) {
        o.selected = undefined
        o.status = 'sent'
        return { ok: true }
      }
      o.selected = index
      o.status = 'accepted'
      return { ok: true }
    })
  },

  guestSign(offerId: ID, signerName: string) {
    return useStore.getState().act((db) => {
      const o = db.offers.find((x) => x.id === offerId)!
      if (o.status === 'signed' || o.status === 'paid') return { ok: true }
      if (o.selected === undefined) return { ok: false, error: 'Choose an option first.' }
      o.status = 'signed'
      o.signedAt = now()
      o.signerName = signerName
      db.business.usage.signaturesThisMonth += 1
      const inq = db.inquiries.find((i) => i.id === o.inquiryId)!
      audit(db, signerName, 'Signed agreement', `${inq.studentName} · ${o.options[o.selected].name} (v${o.version})`)
      return { ok: true }
    })
  },

  /** Simulates a verified Stripe payment event. Repeated events never create a second enrollment or charge. */
  guestPay(offerId: ID, outcome: 'success' | 'decline') {
    return useStore.getState().act<ID>((db) => {
      const o = db.offers.find((x) => x.id === offerId)!
      if (o.status === 'paid') return { ok: true, value: o.purchaseId }
      if (o.status !== 'signed' || o.selected === undefined) return { ok: false, error: 'Sign the agreement before paying.' }
      const inq = db.inquiries.find((i) => i.id === o.inquiryId)!
      if (outcome === 'decline') {
        audit(db, 'Stripe', 'Checkout payment declined', inq.studentName)
        return { ok: false, error: 'Your card was declined. No charge was made — try another card.' }
      }
      const opt = o.options[o.selected]
      const start = new Date()
      let guardianId: ID | undefined
      if (!inq.independent) {
        guardianId = uid('g')
        db.guardians.push({ id: guardianId, name: inq.guardianName, email: inq.guardianEmail, phone: inq.guardianPhone, smsOptIn: false, portal: 'invited' })
      }
      const studentId = uid('s')
      const student: Student = {
        id: studentId, name: inq.studentName, email: inq.studentEmail, smsOptIn: false, grade: inq.grade, school: inq.school, goals: inq.goals, assignedCoachId: o.coachId, poolId: null,
        status: 'active', portal: 'invited', studentCanBook: inq.independent, independent: inq.independent, source: inq.source, createdAt: now(),
        guardians: guardianId ? [{ guardianId, relationship: 'Parent', canBook: true, followUps: true, homework: true, billing: true, payer: true, signer: true }] : [],
      }
      db.students.push(student)
      const per = opt.kind === 'monthly' ? opt.priceCents : Math.round(opt.priceCents / opt.installments)
      const count = opt.kind === 'monthly' ? 3 : opt.installments
      const step = opt.kind === 'monthly' ? 30 : 28
      const installments: Installment[] = Array.from({ length: count }, (_, i) => ({
        id: uid('in'), dueDate: addDays(start, i * step).toISOString(),
        amountCents: opt.kind === 'fixed' && i === count - 1 ? opt.priceCents - per * (count - 1) : per,
        status: i === 0 ? 'paid' : 'scheduled', paidAt: i === 0 ? now() : undefined, ref: i === 0 ? `pi_${Math.random().toString(36).slice(2, 12)}` : undefined,
      }))
      const purchase: Purchase = {
        id: uid('pu'), studentId, offerId: o.id, name: opt.name, kind: opt.kind, credits: opt.credits, priceCents: opt.priceCents, startDate: start.toISOString(),
        endDate: addDays(start, opt.kind === 'monthly' ? 90 : opt.termWeeks * 7).toISOString(), sessionTypeIds: opt.sessionTypeIds, installments, status: 'active', policy: o.policy,
      }
      db.purchases.push(purchase)
      o.status = 'paid'
      o.paidAt = now()
      o.purchaseId = purchase.id
      inq.stage = 'enrolled'
      inq.studentId = studentId
      notify(db, 'email', inq.independent ? inq.studentName : inq.guardianName, `Payment received — set up your ${db.business.name} portal`, 'delivered')
      if (inq.studentEmail && !inq.independent) notify(db, 'email', inq.studentName, `You're invited to the ${db.business.name} portal`, 'delivered')
      task(db, { title: `Schedule first sessions for ${inq.studentName}`, detail: `${opt.name} is paid${installments.length > 1 ? ' (first installment)' : ''}. Set up recurring sessions.`, assigneeId: o.coachId, kind: 'handoff', link: `/app/clients/${studentId}` })
      audit(db, 'Stripe', 'Payment succeeded', `${inq.studentName} · ${money(installments[0].amountCents)} · enrollment activated`)
      return { ok: true, value: purchase.id }
    })
  },

  recordPayment(purchaseId: ID, installmentId: ID, outcome: 'paid' | 'failed', actorId: ID) {
    return useStore.getState().act((db) => {
      const p = db.purchases.find((x) => x.id === purchaseId)!
      const i = p.installments.find((x) => x.id === installmentId)!
      const s = db.students.find((x) => x.id === p.studentId)!
      if (i.status === 'paid') return { ok: true, message: 'Already paid — duplicate event ignored' }
      const payer = s.guardians.find((l) => l.payer)
      const payerName = payer ? db.guardians.find((g) => g.id === payer.guardianId)!.name : s.name
      if (outcome === 'paid') {
        const before = purchaseBalance(db, p.id).funded
        i.status = 'paid'
        i.paidAt = now()
        i.ref = `pi_${Math.random().toString(36).slice(2, 12)}`
        const after = purchaseBalance(db, p.id).funded
        notify(db, 'email', payerName, `Payment received — ${p.name}`, 'delivered')
        db.issues.filter((x) => x.kind === 'payment_failed' && x.status === 'open' && x.link?.includes(s.id)).forEach((x) => {
          x.status = 'resolved'
          x.history.push({ at: now(), text: 'Payment succeeded; issue resolved automatically' })
        })
        db.tasks.filter((t) => t.kind === 'payment' && t.link?.includes(s.id)).forEach((t) => (t.status = 'done'))
        audit(db, 'Stripe', 'Payment succeeded', `${s.name} · ${money(i.amountCents)} · funded ${Math.round((after - before) * 100) / 100} credits`)
        return { ok: true, message: `Payment recorded. ${Math.round((after - before) * 100) / 100} credits funded.` }
      }
      i.status = 'failed'
      notify(db, 'email', payerName, `Payment unsuccessful — ${p.name}`, 'delivered')
      db.issues.unshift({ id: uid('iss'), kind: 'payment_failed', title: `Payment failed — ${s.name}`, detail: `Stripe reported a failed charge for ${money(i.amountCents)}.`, ownerId: responsibleAdmin(db).id, link: `/app/clients/${s.id}?tab=billing`, status: 'open', createdAt: now(), history: [{ at: now(), text: 'Stripe event received: payment_intent.payment_failed' }] })
      audit(db, 'Stripe', 'Payment failed', `${s.name} · ${money(i.amountCents)} · requested by ${nameOf(db, actorId)}`)
      return { ok: true, message: 'Failure recorded and routed to the issue queue.' }
    })
  },

  book(input: BookingInput, weeks: number, actor: string) {
    return useStore.getState().act<{ created: number; skipped: number }>((db) => {
      const st = db.sessionTypes.find((s) => s.id === input.sessionTypeId)!
      const seriesId = weeks > 1 ? uid('ser') : undefined
      const pol = db.purchases.find((p) => p.id === input.purchaseId)!.policy
      const student = db.students.find((s) => s.id === input.studentId)!
      let created = 0
      let skipped = 0
      for (let w = 0; w < weeks; w++) {
        const start = addDays(input.start, w * 7)
        const r = validateBooking(db, { ...input, start })
        if (!r.ok) {
          skipped++
          continue
        }
        db.appointments.push({
          id: uid('ap'), studentId: input.studentId, coachId: input.coachId, sessionTypeId: st.id, purchaseId: input.purchaseId, kind: 'coaching', start: start.toISOString(), minutes: st.minutes, credits: st.credits,
          status: 'scheduled', seriesId, isMakeup: r.isMakeup || undefined, viaPool: student.assignedCoachId !== input.coachId || undefined, meeting: meetingFor(db, st.meeting),
          policy: { noticeHours: pol.cancelNoticeHours, lateOutcome: pol.lateCancelOutcome, noShowOutcome: db.business.policies.noShowOutcome }, createdAt: now(), createdBy: actor,
        })
        created++
      }
      if (!created) return { ok: false, error: 'No sessions could be booked. Check the highlighted requirements.' }
      familyContacts(db, input.studentId, (l) => l.canBook || l.payer).forEach((to) => notify(db, 'email', to, `Session confirmed with ${nameOf(db, input.coachId)}${created > 1 ? ` (${created} weekly sessions)` : ''}`, 'delivered'))
      audit(db, actor, created > 1 ? 'Booked recurring sessions' : 'Booked session', `${student.name} · ${created} session${created > 1 ? 's' : ''}${skipped ? ` · ${skipped} skipped` : ''}`)
      return { ok: true, value: { created, skipped } }
    })
  },

  cancel(apptId: ID, by: 'family' | 'business', actor: string, reason: string, exception?: { by: ID; reason: string }) {
    return useStore.getState().act((db) => {
      const a = db.appointments.find((x) => x.id === apptId)!
      if (a.status !== 'scheduled') return { ok: false, error: 'This appointment is no longer scheduled.' }
      const pv = cancelPreview(a, by)
      a.status = pv.status
      a.canceledAt = now()
      a.canceledBy = actor
      a.cancelReason = reason
      if (pv.status === 'canceled_late') {
        a.lateOutcomeApplied = exception ? 'preserve' : a.policy.lateOutcome
        if (exception) a.exception = exception
      }
      const refund = settleGuestPayment(db, a, by === 'business' || !!exception)
      if (a.studentId) familyContacts(db, a.studentId).forEach((to) => notify(db, 'email', to, `Session on ${new Date(a.start).toLocaleDateString()} cancelled`, 'delivered'))
      notify(db, 'email', nameOf(db, a.coachId), `Cancellation: ${a.studentId ? db.students.find((s) => s.id === a.studentId)!.name : 'fit call'}`, 'delivered')
      audit(db, actor, 'Cancelled session', `${pv.outcome}${exception ? ` · exception: ${exception.reason}` : ''}${refund ? ` · ${refund}` : ''}`)
      return { ok: true, message: a.kind === 'consultation' ? `Call cancelled${refund ? `. ${refund}` : ''}` : pv.creditEffect }
    })
  },

  reschedule(apptId: ID, newStart: Date, actorKind: 'family' | 'staff', actor: string) {
    return useStore.getState().act((db) => {
      const a = db.appointments.find((x) => x.id === apptId)!
      if (!a.purchaseId || !a.studentId) return { ok: false, error: 'Only coaching sessions can be rescheduled here.' }
      const pv = cancelPreview(a, actorKind === 'staff' ? 'business' : 'family')
      // Release the original hold together with validating the replacement.
      const original = { ...a }
      a.status = pv.status === 'canceled_late' ? 'canceled_late' : pv.status
      a.lateOutcomeApplied = pv.status === 'canceled_late' ? a.policy.lateOutcome : undefined
      const r = validateBooking(db, { studentId: a.studentId, coachId: a.coachId, sessionTypeId: a.sessionTypeId, purchaseId: a.purchaseId, start: newStart, actorKind: actorKind === 'staff' ? 'staff' : 'family' })
      if (!r.ok) {
        Object.assign(a, original)
        return { ok: false, error: r.checks.find((c) => !c.ok)?.detail ?? 'That time is not available.' }
      }
      a.canceledAt = now()
      a.canceledBy = actor
      a.cancelReason = 'Rescheduled'
      db.appointments.push({ ...original, id: uid('ap'), start: newStart.toISOString(), createdAt: now(), createdBy: actor, isMakeup: r.isMakeup || undefined, meeting: meetingFor(db, original.meeting.type), status: 'scheduled' })
      if (a.studentId) familyContacts(db, a.studentId).forEach((to) => notify(db, 'email', to, `Session moved to ${newStart.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`, 'delivered'))
      audit(db, actor, 'Rescheduled session', `${pv.timely ? 'Within policy' : 'Late change — policy applied'}`)
      return { ok: true, message: pv.timely ? 'Rescheduled. Reminders were recalculated.' : `Rescheduled. ${pv.creditEffect}.` }
    })
  },

  markAttendance(apptId: ID, status: 'attended' | 'no_show', actorId: ID) {
    return useStore.getState().act((db) => {
      const a = db.appointments.find((x) => x.id === apptId)!
      if (status === 'attended' && apptCoverage(db, a) === 'payment_needed') return { ok: false, error: 'Paid coverage is required before coaching is delivered. Ask an administrator to resolve the payment.' }
      a.status = status
      if (status === 'no_show') a.lateOutcomeApplied = a.policy.noShowOutcome
      if (status === 'attended' && a.kind === 'coaching' && a.meeting.type === 'zoom' && !a.source) a.source = { kind: 'zoom', status: 'pending', text: '' }
      audit(db, nameOf(db, actorId), status === 'attended' ? 'Marked attended' : 'Marked no-show', a.studentId ? db.students.find((s) => s.id === a.studentId)!.name : 'Fit call')
      return { ok: true }
    })
  },

  /** The background job that evaluates each unfunded reservation at the business's cutoff (D-026). */
  runScheduledJobs(actor = 'Scheduled job') {
    return useStore.getState().act<number>((db) => {
      const p = db.business.policies
      const t = Date.now()
      let canceled = 0
      let warned = 0
      const cache = new Map()
      for (const a of db.appointments.filter((x) => x.status === 'scheduled' && x.kind === 'coaching')) {
        const start = new Date(a.start).getTime()
        if (start < t) continue
        if (apptCoverage(db, a, cache) !== 'payment_needed') continue
        const within = start - t <= p.unpaidCutoffHours * 3600000
        const s = db.students.find((x) => x.id === a.studentId)!
        if (within && p.autoCancelUnpaid) {
          a.status = 'canceled_unpaid'
          a.canceledAt = now()
          a.canceledBy = actor
          a.cancelReason = `Not funded ${p.unpaidCutoffHours}h before the session`
          cache.clear()
          canceled++
          familyContacts(db, s.id, (l) => l.payer || l.canBook).forEach((to) => notify(db, 'email', to, `Unpaid session released — ${new Date(a.start).toLocaleDateString()}`, 'delivered'))
          notify(db, 'email', nameOf(db, a.coachId), `Session released (unpaid): ${s.name}`, 'delivered')
          audit(db, actor, 'Released unpaid reservation', `${s.name} · ${new Date(a.start).toLocaleString()}`)
        } else if (within) {
          warned++
          task(db, { title: `Unpaid session soon — ${s.name}`, detail: 'Coaching cannot be delivered until funded. Automatic cancellation is off.', assigneeId: responsibleAdmin(db).id, kind: 'payment', link: `/app/clients/${s.id}?tab=billing` })
        }
      }
      return { ok: true, value: canceled, message: canceled ? `Released ${canceled} unpaid reservation${canceled > 1 ? 's' : ''}` : warned ? `${warned} unpaid session${warned > 1 ? 's' : ''} flagged for staff` : 'No unpaid reservations within the cutoff' }
    })
  },

  saveNotes(apptId: ID, notes: string) {
    return useStore.getState().act((db) => {
      db.appointments.find((x) => x.id === apptId)!.privateNotes = notes
      return { ok: true }
    })
  },

  setSource(apptId: ID, kind: 'manual' | 'transcript', text: string, actorId: ID) {
    return useStore.getState().act((db) => {
      const a = db.appointments.find((x) => x.id === apptId)!
      if (text.trim().length < 20) return { ok: false, error: 'Add a few sentences about the session first.' }
      a.source = { kind, status: 'ready', text, at: now() }
      db.issues.filter((i) => i.kind === 'zoom_summary' && i.status === 'open' && i.link?.includes(apptId)).forEach((i) => {
        i.status = 'resolved'
        i.history.push({ at: now(), text: `${nameOf(db, actorId)} added ${kind === 'manual' ? 'manual notes' : 'a transcript'}` })
      })
      return { ok: true }
    })
  },

  importZoom(apptId: ID) {
    return useStore.getState().act((db) => {
      const a = db.appointments.find((x) => x.id === apptId)!
      if (a.source?.status === 'unavailable') {
        const iss = db.issues.find((i) => i.link?.includes(apptId))
        iss?.history.push({ at: now(), text: 'Retry: Zoom still reports no summary for this meeting instance' })
        return { ok: false, error: 'Zoom has no summary for this meeting. Add manual notes or paste a transcript.' }
      }
      const s = db.students.find((x) => x.id === a.studentId)!
      const f = s.name.split(' ')[0]
      a.source = { kind: 'zoom', status: 'ready', at: now(), text: `${f} checked in on the past week and talked through what got done. ${f} finished the main assignment early and was proud of staying on schedule. The hardest part was getting started on reading. We agreed ${f} will try a 20-minute focus block before dinner. Next step: plan the week on Sunday and bring questions about the upcoming test.` }
      return { ok: true }
    })
  },

  generateFollowUp(apptId: ID, mode: 'separate' | 'shared', actorId: ID) {
    return useStore.getState().act<ID>((db) => {
      const a = db.appointments.find((x) => x.id === apptId)!
      if (a.source?.status !== 'ready') return { ok: false, error: 'A session source is required before drafting.' }
      const versions = draftFollowUp(db, a, mode)
      const existing = db.followUps.find((f) => f.appointmentId === apptId && f.status !== 'published')
      db.business.usage.aiDraftsThisMonth += 1
      if (existing) {
        existing.versions = versions
        existing.mode = mode
        existing.createdAt = now()
        return { ok: true, value: existing.id }
      }
      const fu = { id: uid('fu'), appointmentId: apptId, studentId: a.studentId!, coachId: a.coachId, mode, versions, status: 'draft' as const, sourceKind: a.source.kind, createdAt: now(), deliveries: [] }
      db.followUps.push(fu)
      audit(db, nameOf(db, actorId), 'Prepared follow-up drafts', `${db.students.find((s) => s.id === a.studentId)!.name} · ${mode === 'shared' ? 'shared version' : 'student and parent versions'}`)
      return { ok: true, value: fu.id }
    })
  },

  updateFollowUpVersion(fuId: ID, audience: string, patch: { subject?: string; body?: string }) {
    return useStore.getState().act((db) => {
      const v = db.followUps.find((f) => f.id === fuId)!.versions.find((x) => x.audience === audience)!
      Object.assign(v, patch)
      return { ok: true }
    })
  },

  publishFollowUp(fuId: ID, actorId: ID) {
    return useStore.getState().act((db) => {
      const f = db.followUps.find((x) => x.id === fuId)!
      if (f.status === 'published') return { ok: true, message: 'Already published — not sent again' }
      f.deliveries = plannedDeliveries(db, f)
      f.status = 'published'
      f.publishedAt = now()
      f.publishedBy = actorId
      for (const d of f.deliveries) {
        if (d.status === 'sent') notify(db, 'email', d.recipient, `New session follow-up from ${nameOf(db, f.coachId)} — view in portal`, 'delivered')
      }
      db.tasks.filter((t) => t.kind === 'followup' && t.link?.includes(f.appointmentId)).forEach((t) => (t.status = 'done'))
      const held = f.deliveries.filter((d) => d.status === 'held').length
      audit(db, nameOf(db, actorId), 'Published follow-up', `${db.students.find((s) => s.id === f.studentId)!.name} · ${f.deliveries.length - held} sent${held ? `, ${held} held by permissions` : ''}`)
      return { ok: true, message: `Published to the portal and emailed ${f.deliveries.length - held} recipient${f.deliveries.length - held === 1 ? '' : 's'}${held ? ` · ${held} held by permissions` : ''}` }
    })
  },

  createHomework(h: Omit<Homework, 'id' | 'createdAt' | 'status'>, actorId: ID) {
    return useStore.getState().act((db) => {
      if (!h.title.trim()) return { ok: false, error: 'Give the assignment a title.' }
      db.homework.unshift({ ...h, id: uid('hw'), createdAt: now(), status: 'assigned' })
      const s = db.students.find((x) => x.id === h.studentId)!
      notify(db, 'email', s.name, `New homework: ${h.title}`, 'delivered')
      audit(db, nameOf(db, actorId), 'Assigned homework', `${s.name} · ${h.title}`)
      return { ok: true }
    })
  },

  setHomeworkStatus(hwId: ID, status: Homework['status'], response?: string) {
    return useStore.getState().act((db) => {
      const h = db.homework.find((x) => x.id === hwId)!
      h.status = status
      if (status === 'complete') {
        h.response = response
        h.completedAt = now()
        notify(db, 'email', nameOf(db, h.coachId), `Homework marked complete: ${h.title}`, 'delivered')
      }
      return { ok: true }
    })
  },

  uploadFile(name: string, sizeKb: number, studentIds: ID[], by: ID) {
    return useStore.getState().act((db) => {
      const ext = name.split('.').pop()?.toLowerCase()
      if (!['pdf', 'docx', 'xlsx', 'png', 'jpg', 'pptx'].includes(ext ?? '')) return { ok: false, error: 'Supported files: PDF, DOCX, XLSX, PPTX, PNG, JPG.' }
      if (sizeKb > 10240) return { ok: false, error: 'Files must be 10 MB or smaller.' }
      db.files.unshift({ id: uid('f'), name, sizeKb, uploadedBy: by, studentIds, createdAt: now() })
      return { ok: true }
    })
  },

  shareFile(fileId: ID, studentIds: ID[]) {
    return useStore.getState().act((db) => {
      db.files.find((f) => f.id === fileId)!.studentIds = studentIds
      return { ok: true }
    })
  },

  inviteStaff(data: { name: string; email: string; role: Staff['role']; title: string }, actorId: ID) {
    return useStore.getState().act((db) => {
      const plan = planById(db.business.plan)
      const used = db.staff.filter((s) => s.status === 'active' || s.status === 'invited').length
      if (used >= plan.seats) return { ok: false, error: `Your ${plan.name} plan includes ${plan.seats} staff seat${plan.seats > 1 ? 's' : ''}, and all are in use or reserved by invitations.` }
      if (db.staff.some((s) => s.email.toLowerCase() === data.email.toLowerCase())) return { ok: false, error: 'Someone with that email is already on the team.' }
      db.staff.push({ ...data, id: uid('st'), coaches: data.role === 'coach', status: 'invited', availability: [], googleConnected: false, calendarHealthy: true, invitedAt: now(), financial: data.role === 'admin' ? false : undefined })
      notify(db, 'email', data.name, `${nameOf(db, actorId)} invited you to ${db.business.name} on schedulefa.st`, 'delivered')
      audit(db, nameOf(db, actorId), 'Invited staff', `${data.name} · ${data.role}`)
      return { ok: true }
    })
  },

  updateStaff(staffId: ID, patch: Partial<Staff>, actorId: ID) {
    return useStore.getState().act((db) => {
      const s = db.staff.find((x) => x.id === staffId)!
      if (patch.status === 'active' && s.status === 'inactive') {
        const plan = planById(db.business.plan)
        const used = db.staff.filter((x) => x.status === 'active' || x.status === 'invited').length
        if (used >= plan.seats) return { ok: false, error: 'No staff seats available. Upgrade or free a seat first.' }
      }
      if (patch.status === 'inactive') {
        const future = db.appointments.filter((a) => a.coachId === staffId && a.status === 'scheduled' && new Date(a.start) > new Date())
        if (future.length) return { ok: false, error: `${s.name} has ${future.length} upcoming session${future.length > 1 ? 's' : ''}. Reassign or resolve them first.` }
      }
      Object.assign(s, patch)
      audit(db, nameOf(db, actorId), 'Updated staff member', `${s.name}${patch.status ? ` → ${patch.status}` : ''}${patch.role ? ` → ${patch.role}` : ''}`)
      return { ok: true }
    })
  },

  removeInvite(staffId: ID, actorId: ID) {
    return useStore.getState().act((db) => {
      const s = db.staff.find((x) => x.id === staffId)!
      db.staff = db.staff.filter((x) => x.id !== staffId)
      audit(db, nameOf(db, actorId), 'Revoked invitation', s.name)
      return { ok: true }
    })
  },

  setAvailability(staffId: ID, availability: Availability[]) {
    return useStore.getState().act((db) => {
      db.staff.find((x) => x.id === staffId)!.availability = availability
      return { ok: true }
    })
  },

  reassignClient(studentId: ID, coachId: ID, actorId: ID) {
    return useStore.getState().act((db) => {
      const s = db.students.find((x) => x.id === studentId)!
      const from = s.assignedCoachId
      s.assignedCoachId = coachId
      let moved = 0
      db.appointments.filter((a) => a.studentId === studentId && a.status === 'scheduled' && a.coachId === from && new Date(a.start) > new Date()).forEach((a) => {
        a.coachId = coachId
        moved++
      })
      audit(db, nameOf(db, actorId), 'Reassigned client', `${s.name} → ${nameOf(db, coachId)} · ${moved} upcoming sessions moved`)
      return { ok: true, message: `${s.name} is now with ${nameOf(db, coachId)}. ${moved} upcoming session${moved === 1 ? '' : 's'} moved.` }
    })
  },

  updatePolicies(patch: Partial<Policies>, actorId: ID) {
    return useStore.getState().act((db) => {
      Object.assign(db.business.policies, patch)
      audit(db, nameOf(db, actorId), 'Updated business settings', Object.keys(patch).join(', '))
      return { ok: true }
    })
  },

  setIntegration(key: IntegrationKey, status: 'connected' | 'disconnected', actorId: ID) {
    return useStore.getState().act((db) => {
      db.business.integrations[key].status = status
      if (key === 'google' && status === 'connected') {
        db.staff.forEach((s) => {
          if (s.coaches && s.status === 'active') {
            s.googleConnected = true
            s.calendarHealthy = true
          }
        })
        db.issues.filter((i) => i.kind === 'calendar_sync' && i.status === 'open').forEach((i) => {
          i.status = 'resolved'
          i.history.push({ at: now(), text: 'Reconnected; availability refreshed' })
        })
        db.tasks.filter((t) => t.kind === 'calendar').forEach((t) => (t.status = 'done'))
        db.business.integrations.google.account = 'All coaches connected'
      }
      audit(db, nameOf(db, actorId), status === 'connected' ? 'Connected integration' : 'Disconnected integration', key)
      return { ok: true }
    })
  },

  resolveIssue(issueId: ID, note: string, actorId: ID) {
    return useStore.getState().act((db) => {
      const i = db.issues.find((x) => x.id === issueId)!
      i.status = 'resolved'
      i.history.push({ at: now(), text: `${nameOf(db, actorId)}: ${note || 'Marked resolved'}` })
      return { ok: true }
    })
  },

  setTask(taskId: ID, status: 'open' | 'done') {
    return useStore.getState().act((db) => {
      db.tasks.find((t) => t.id === taskId)!.status = status
      return { ok: true }
    })
  },

  addAdjustment(purchaseId: ID, credits: number, reason: string, actorId: ID) {
    return useStore.getState().act((db) => {
      if (!reason.trim()) return { ok: false, error: 'A reason is required for every adjustment.' }
      if (!credits) return { ok: false, error: 'Enter a non-zero credit amount.' }
      db.adjustments.push({ id: uid('adj'), purchaseId, credits, reason, by: actorId, at: now() })
      audit(db, nameOf(db, actorId), 'Authorized credit adjustment', `${credits > 0 ? '+' : ''}${credits} · ${reason}`)
      return { ok: true }
    })
  },

  addExistingClient(
    data: { name: string; grade: string; school: string; email?: string; independent: boolean; guardianName?: string; guardianEmail?: string; coachId: ID; offeringId: ID; startDate: Date; usedCredits: number; paidCents: number; verifiedNote: string },
    actorId: ID,
  ) {
    return useStore.getState().act<ID>((db) => {
      const off = db.offerings.find((o) => o.id === data.offeringId)!
      const studentId = uid('s')
      const guardians: GuardianLink[] = []
      if (!data.independent && data.guardianName) {
        const gid = uid('g')
        db.guardians.push({ id: gid, name: data.guardianName, email: data.guardianEmail ?? '', smsOptIn: false, portal: 'invited' })
        guardians.push({ guardianId: gid, relationship: 'Parent', canBook: true, followUps: true, homework: true, billing: true, payer: true, signer: true })
      }
      db.students.push({ id: studentId, name: data.name, email: data.email, smsOptIn: false, grade: data.grade, school: data.school, goals: '', assignedCoachId: data.coachId, poolId: null, status: data.paidCents > 0 ? 'active' : 'pending', portal: data.paidCents > 0 ? 'invited' : 'none', studentCanBook: data.independent, independent: data.independent, source: 'Existing client', createdAt: now(), guardians, manualEntry: true })
      const pid = uid('pu')
      const verified = data.paidCents > 0 && data.verifiedNote.trim().length > 0
      db.purchases.push({
        id: pid, studentId, name: off.name, kind: off.kind, credits: off.credits, priceCents: off.priceCents, startDate: data.startDate.toISOString(), endDate: addDays(data.startDate, off.kind === 'monthly' ? 90 : off.termWeeks * 7).toISOString(),
        sessionTypeIds: off.sessionTypeIds, status: 'active', policy: { cancelNoticeHours: off.cancelNoticeHours, lateCancelOutcome: db.business.policies.lateCancelOutcome, makeupWindowDays: db.business.policies.makeupWindowDays },
        installments: verified ? [{ id: uid('in'), dueDate: data.startDate.toISOString(), amountCents: Math.min(data.paidCents, off.priceCents), status: 'paid', paidAt: data.startDate.toISOString(), historical: true, ref: data.verifiedNote }] : [{ id: uid('in'), dueDate: data.startDate.toISOString(), amountCents: off.priceCents, status: 'scheduled' }],
        historical: verified ? { verifiedBy: actorId, note: data.verifiedNote, at: now() } : undefined,
      })
      if (data.usedCredits > 0) db.adjustments.push({ id: uid('adj'), purchaseId: pid, credits: -data.usedCredits, reason: `Opening balance: ${data.usedCredits} sessions delivered before schedulefa.st`, by: actorId, at: now() })
      audit(db, nameOf(db, actorId), verified ? 'Added existing client with verified paid coverage' : 'Added existing client (payment unverified)', data.name)
      return { ok: true, value: studentId }
    })
  },

  updateStudent(studentId: ID, patch: Partial<Student>) {
    return useStore.getState().act((db) => {
      Object.assign(db.students.find((s) => s.id === studentId)!, patch)
      return { ok: true }
    })
  },

  updateGuardianLink(studentId: ID, guardianId: ID, patch: Partial<GuardianLink>, actorId: ID) {
    return useStore.getState().act((db) => {
      const s = db.students.find((x) => x.id === studentId)!
      Object.assign(s.guardians.find((l) => l.guardianId === guardianId)!, patch)
      audit(db, nameOf(db, actorId), 'Changed guardian permissions', `${s.name} · ${db.guardians.find((g) => g.id === guardianId)!.name}`)
      return { ok: true }
    })
  },

  grant(staffId: ID, studentId: ID, scope: 'client' | 'private_notes', reason: string, days: number | null, actorId: ID) {
    return useStore.getState().act((db) => {
      if (!reason.trim()) return { ok: false, error: 'Record why access is being granted.' }
      db.grants.push({ id: uid('gr'), staffId, studentId, scope, reason, grantedBy: actorId, expiresAt: days ? addDays(new Date(), days).toISOString() : undefined })
      audit(db, nameOf(db, actorId), scope === 'private_notes' ? 'Granted private-note access' : 'Granted client access', `${nameOf(db, staffId)} · ${db.students.find((s) => s.id === studentId)!.name}`)
      return { ok: true }
    })
  },

  revokeGrant(grantId: ID, actorId: ID) {
    return useStore.getState().act((db) => {
      const g = db.grants.find((x) => x.id === grantId)!
      db.grants = db.grants.filter((x) => x.id !== grantId)
      audit(db, nameOf(db, actorId), 'Revoked access grant', `${nameOf(db, g.staffId)} · ${db.students.find((s) => s.id === g.studentId)!.name}`)
      return { ok: true }
    })
  },

  saveOffering(o: Offering, actorId: ID) {
    return useStore.getState().act((db) => {
      if (!o.name.trim()) return { ok: false, error: 'Name the offering.' }
      if (o.credits <= 0) return { ok: false, error: 'Include at least one credit.' }
      const i = db.offerings.findIndex((x) => x.id === o.id)
      if (i >= 0) db.offerings[i] = o
      else db.offerings.push(o)
      audit(db, nameOf(db, actorId), i >= 0 ? 'Updated offering' : 'Created offering', `${o.name} · applies to new agreements only`)
      return { ok: true }
    })
  },

  changePlan(to: PlanId, keepStaffIds: ID[] | null, actorId: ID) {
    return useStore.getState().act((db) => {
      const target = planById(to)
      const current = planById(db.business.plan)
      if (target.seats >= current.seats && target.monthlyCents >= current.monthlyCents) {
        db.business.plan = to
        db.business.pendingPlanChange = undefined
        audit(db, nameOf(db, actorId), 'Upgraded plan', target.name)
        return { ok: true, message: `You're on ${target.name}.` }
      }
      const keep = keepStaffIds ?? []
      if (keep.length > target.seats) return { ok: false, error: `Choose at most ${target.seats} staff to keep active.` }
      if (!keep.includes(db.staff.find((s) => s.role === 'owner')!.id)) return { ok: false, error: 'The owner must stay active.' }
      db.business.pendingPlanChange = { to, effective: addDays(new Date(), 12).toISOString(), keepStaffIds: keep }
      audit(db, nameOf(db, actorId), 'Scheduled downgrade', `${target.name} at next renewal`)
      return { ok: true, message: `Scheduled for your next renewal.` }
    })
  },

  cancelPlanChange(actorId: ID) {
    return useStore.getState().act((db) => {
      db.business.pendingPlanChange = undefined
      audit(db, nameOf(db, actorId), 'Cancelled scheduled plan change', '')
      return { ok: true }
    })
  },

  /** Demo helper: run the renewal boundary now. Activation is blocked while staff becoming inactive still own future sessions (P-16). */
  applyPlanChange(actorId: ID) {
    return useStore.getState().act((db) => {
      const pc = db.business.pendingPlanChange
      if (!pc) return { ok: false, error: 'No scheduled change.' }
      const leaving = db.staff.filter((s) => (s.status === 'active' || s.status === 'invited') && !pc.keepStaffIds.includes(s.id))
      const blocking = leaving.filter((s) => db.appointments.some((a) => a.coachId === s.id && a.status === 'scheduled' && new Date(a.start) > new Date()))
      if (blocking.length) return { ok: false, error: `Not activated: ${blocking.map((b) => b.name).join(', ')} still ${blocking.length > 1 ? 'have' : 'has'} upcoming sessions. Reassign them first. You stay on your current plan.` }
      leaving.forEach((s) => {
        if (s.status === 'invited') db.staff = db.staff.filter((x) => x.id !== s.id)
        else s.status = 'inactive'
      })
      db.business.plan = pc.to
      db.business.pendingPlanChange = undefined
      audit(db, nameOf(db, actorId), 'Plan change took effect', `${planById(pc.to).name} · ${leaving.length} staff made inactive; records preserved`)
      return { ok: true, message: `Now on ${planById(pc.to).name}. Historical records were preserved.` }
    })
  },
}
