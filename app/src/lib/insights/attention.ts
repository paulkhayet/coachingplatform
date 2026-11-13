import { addDays, localDay } from './finance'

// The attention queue on the team dashboard (D-074): things an owner or administrator should act on.
// Pure rules over facts the loader hands in, so each one can be tested at its edges.

const HOUR = 3_600_000
const DAY = 24 * HOUR

export const ATTENTION_GROUPS = [
  { kind: 'inquiry', label: 'Inquiries' },
  { kind: 'payment', label: 'Payments' },
  { kind: 'credits', label: 'Credits' },
  { kind: 'scheduling', label: 'Scheduling' },
  { kind: 'attendance', label: 'Attendance' },
  { kind: 'problem', label: 'Errors' },
  { kind: 'team', label: 'Team' },
] as const
export type AttentionGroup = (typeof ATTENTION_GROUPS)[number]['kind']

export interface AttentionItem {
  /** Stable across loads, for React keys. */
  key: string
  group: AttentionGroup
  title: string
  /** The client, family or coach it's about. */
  subject: string
  /** When it happened or falls due; shown as "3 days ago" or "in 5 hours". */
  at: Date | null
  href: string
  action: string
}

export interface InquiryFact {
  id: string
  studentName: string
  stage: 'new' | 'matching' | 'first_call' | 'offer' | 'enrolled' | 'lost'
  createdAt: Date
  nextAction: string | null
  /** YYYY-MM-DD. */
  nextActionDue: string | null
}

export interface CreditPeriodFact {
  id: string
  clientId: string
  clientName: string
  name: string
  /** YYYY-MM-DD; the period runs up to, not including, endsOn. */
  startsOn: string
  endsOn: string
  priceCents: number
  paidCents: number
  /** Credits are hundredths: 100 units is one credit. */
  creditUnits: number
  reservedUnits: number
  usedUnits: number
  forfeitedUnits: number
  expiredUnits: number
}

export interface AttentionSession {
  id: string
  clientId: string | null
  /** The client for coaching sessions, the guest for calls. */
  who: string
  title: string
  startsAt: Date
  endsAt: Date
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'expired'
  attendedAt: Date | null
  creditCoveredAt: Date | null
  unpaidCancellationHours: number | null
  calendarSyncError: string | null
  meetingError: string | null
  paymentStatus: string
  cancelledAt: Date | null
}

export interface CoachFact {
  id: string
  name: string
  /** Whether they've saved working hours (their default, or hours just for this business). */
  hasHours: boolean
  calendar: 'active' | 'needs_reconnect' | null
}

export interface AttentionFacts {
  timeZone: string
  now: Date
  inquiries: InquiryFact[]
  periods: CreditPeriodFact[]
  sessions: AttentionSession[]
  coaches: CoachFact[]
}

const clientHref = (id: string) => `/app/clients/${id}`
const inquiryHref = (id: string) => `/app/dashboard/intake/${id}`
const sessionHref = (s: AttentionSession) => (s.clientId ? `/app/bookings/coaching/${s.id}` : '/app/bookings')
const formatMoney = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)
const credits = (units: number) => {
  const n = units / 100
  return `${Number.isInteger(n) ? n : n.toFixed(2)} ${n === 1 ? 'credit' : 'credits'}`
}
const remainingUnits = (p: CreditPeriodFact) => Math.max(0, p.creditUnits - p.reservedUnits - p.usedUnits - p.forfeitedUnits - p.expiredUnits)

/** New inquiries nobody has moved on for over a day, and next actions past their date. */
export function inquiryItems({ inquiries, now, timeZone }: AttentionFacts): AttentionItem[] {
  const today = localDay(now, timeZone)
  const items: AttentionItem[] = []
  for (const i of inquiries) {
    if (i.stage === 'enrolled' || i.stage === 'lost') continue
    if (i.stage === 'new' && now.getTime() - i.createdAt.getTime() > DAY) {
      items.push({ key: `new:${i.id}`, group: 'inquiry', title: 'New inquiry waiting for a reply', subject: i.studentName, at: i.createdAt, href: inquiryHref(i.id), action: 'Open inquiry' })
    }
    if (i.nextActionDue && i.nextActionDue < today) {
      const due = new Date(`${i.nextActionDue}T12:00:00Z`)
      items.push({ key: `overdue:${i.id}`, group: 'inquiry', title: `Overdue: ${i.nextAction || 'next step'}`, subject: i.studentName, at: due, href: inquiryHref(i.id), action: 'Open inquiry' })
    }
  }
  return items
}

/** Unpaid reservations about to be released, and packages with money still owed. */
export function paymentItems({ sessions, periods, now }: AttentionFacts): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const s of sessions) {
    if (!s.clientId || s.status !== 'confirmed' || s.creditCoveredAt || s.unpaidCancellationHours === null) continue
    const deadline = new Date(s.startsAt.getTime() - s.unpaidCancellationHours * HOUR)
    if (deadline.getTime() - now.getTime() <= 48 * HOUR) {
      items.push({ key: `cutoff:${s.id}`, group: 'payment', title: 'Unpaid reservation will be released', subject: s.who, at: deadline, href: sessionHref(s), action: 'Open session' })
    }
  }
  for (const p of periods) {
    const owed = p.priceCents - p.paidCents
    if (owed > 0) items.push({ key: `owed:${p.id}`, group: 'payment', title: `${formatMoney(owed)} owed on ${p.name}`, subject: p.clientName, at: null, href: clientHref(p.clientId), action: 'Record payment' })
  }
  return items
}

/** Clients treated as active: a session in the last 30 days, or a credit period that covers today. */
export function activeClients({ sessions, periods, now, timeZone }: AttentionFacts) {
  const today = localDay(now, timeZone)
  const active = new Map<string, string>()
  for (const p of periods) if (p.startsOn <= today && today < p.endsOn) active.set(p.clientId, p.clientName)
  for (const s of sessions) {
    if (s.clientId && s.status === 'confirmed' && s.startsAt <= now && now.getTime() - s.startsAt.getTime() <= 30 * DAY) active.set(s.clientId, s.who)
  }
  return active
}

/** Credits about to expire unused, and active clients who are nearly out. */
export function creditItems(facts: AttentionFacts): AttentionItem[] {
  const { periods, now, timeZone } = facts
  const today = localDay(now, timeZone)
  const soon = addDays(today, 14)
  const items: AttentionItem[] = []
  const left = new Map<string, number>()
  for (const p of periods) {
    const remaining = remainingUnits(p)
    // Credits a client can still book with: this period's and any that hasn't started yet.
    if (today < p.endsOn) left.set(p.clientId, (left.get(p.clientId) ?? 0) + remaining)
    if (remaining > 0 && p.endsOn > today && p.endsOn <= soon) {
      items.push({ key: `expiring:${p.id}`, group: 'credits', title: `${credits(remaining)} unused, ${p.name} ends soon`, subject: p.clientName, at: new Date(`${p.endsOn}T12:00:00Z`), href: clientHref(p.clientId), action: 'Book sessions' })
    }
  }
  for (const [clientId, name] of activeClients(facts)) {
    const remaining = left.get(clientId) ?? 0
    if (remaining <= 100) items.push({ key: `low:${clientId}`, group: 'credits', title: remaining === 0 ? 'No credits left' : `${credits(remaining)} left`, subject: name, at: null, href: clientHref(clientId), action: 'Open client' })
  }
  return items
}

/** Active clients with nothing on the calendar. */
export function schedulingItems(facts: AttentionFacts): AttentionItem[] {
  const upcoming = new Set(facts.sessions.filter((s) => s.clientId && s.status === 'confirmed' && s.startsAt > facts.now).map((s) => s.clientId))
  return [...activeClients(facts)].filter(([id]) => !upcoming.has(id))
    .map(([id, name]) => ({ key: `idle:${id}`, group: 'scheduling' as const, title: 'No upcoming session', subject: name, at: null, href: clientHref(id), action: 'Book a session' }))
}

/** Covered sessions that ended over two days ago and still have no outcome. */
export function attendanceItems({ sessions, now }: AttentionFacts): AttentionItem[] {
  return sessions.filter((s) => s.clientId && s.status === 'confirmed' && s.creditCoveredAt && !s.attendedAt && now.getTime() - s.endsAt.getTime() > 48 * HOUR)
    .map((s) => ({ key: `attendance:${s.id}`, group: 'attendance' as const, title: `${s.title} not marked attended`, subject: s.who, at: s.endsAt, href: sessionHref(s), action: 'Mark attendance' }))
}

/** Upcoming bookings missing from a calendar or without their Zoom link, and refunds that didn't go through. */
export function problemItems({ sessions, now }: AttentionFacts): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const s of sessions) {
    if (s.status === 'confirmed' && s.endsAt > now) {
      if (s.calendarSyncError) items.push({ key: `calendar:${s.id}`, group: 'problem', title: 'Not on Google Calendar', subject: s.who, at: s.startsAt, href: sessionHref(s), action: 'Open booking' })
      if (s.meetingError) items.push({ key: `meeting:${s.id}`, group: 'problem', title: 'Zoom link missing', subject: s.who, at: s.startsAt, href: sessionHref(s), action: 'Open booking' })
    }
    if (s.paymentStatus === 'refund_failed') items.push({ key: `refund:${s.id}`, group: 'problem', title: 'Refund didn’t go through', subject: s.who, at: s.cancelledAt, href: sessionHref(s), action: 'Refund in Stripe' })
  }
  return items
}

/** Coaches still on the default hours, or whose Google Calendar needs reconnecting. */
export function teamItems({ coaches }: AttentionFacts): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const c of coaches) {
    if (!c.hasHours) items.push({ key: `hours:${c.id}`, group: 'team', title: 'Hasn’t set working hours', subject: c.name, at: null, href: '/app/team', action: 'See team' })
    if (c.calendar === 'needs_reconnect') items.push({ key: `google:${c.id}`, group: 'team', title: 'Google Calendar needs reconnecting', subject: c.name, at: null, href: '/app/team', action: 'See team' })
  }
  return items
}

/** Everything that needs attention, grouped in display order. Empty groups are kept so the UI can collapse them. */
export function buildAttention(facts: AttentionFacts) {
  const items = [...inquiryItems(facts), ...paymentItems(facts), ...creditItems(facts), ...schedulingItems(facts), ...attendanceItems(facts), ...problemItems(facts), ...teamItems(facts)]
  return ATTENTION_GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.group === g.kind).sort((a, b) => (a.at?.getTime() ?? Infinity) - (b.at?.getTime() ?? Infinity)) }))
}

/** "3 days ago", "in 5 hours", "today". */
export function relativeTime(at: Date, now: Date) {
  const diff = at.getTime() - now.getTime()
  const abs = Math.abs(diff)
  const unit = abs >= DAY ? [Math.round(abs / DAY), 'day'] as const : abs >= HOUR ? [Math.round(abs / HOUR), 'hour'] as const : [Math.max(1, Math.round(abs / 60_000)), 'minute'] as const
  const text = `${unit[0]} ${unit[1]}${unit[0] === 1 ? '' : 's'}`
  return diff < 0 ? `${text} ago` : `in ${text}`
}
