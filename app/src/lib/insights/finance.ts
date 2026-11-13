import type { PayFormatOverride, PayMethod } from '@/db/schema'
import { zonedParts, zonedTime } from '@/lib/slots'

// Finances for the team dashboard (D-074). Pure: the loader hands in facts, these functions add them up.
// All money is whole cents. A period is a range of calendar days in the business's time zone.

// ── Periods ──────────────────────────────────────────────────────────────────────────────────────────

/** Calendar days in the business's time zone, both inclusive, plus the instants that bound them. */
export interface Period {
  fromDay: string
  toDay: string
  /** Local midnight at the start of `fromDay`. */
  from: Date
  /** Local midnight after `toDay` (exclusive). */
  to: Date
}

export const PERIOD_PRESETS = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
] as const
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]['value']

const pad = (n: number) => String(n).padStart(2, '0')
const dayString = (year: number, month: number, day: number) => {
  const d = new Date(Date.UTC(year, month - 1, day))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
const parseDay = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return { year, month, day: date }
}

/** The calendar day an instant falls on in a time zone, as YYYY-MM-DD. */
export function localDay(instant: Date, timeZone: string) {
  const p = zonedParts(instant, timeZone)
  return dayString(p.year, p.month, p.day)
}

export function addDays(day: string, days: number) {
  const p = parseDay(day)
  return dayString(p.year, p.month, p.day + days)
}

const daysBetween = (fromDay: string, toDay: string) => Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000)

/** A period from two calendar days (inclusive) in the business's time zone. */
export function periodOf(fromDay: string, toDay: string, timeZone: string): Period {
  const a = parseDay(fromDay)
  const b = parseDay(toDay)
  return { fromDay, toDay, from: zonedTime(a.year, a.month, a.day, 0, timeZone), to: zonedTime(b.year, b.month, b.day + 1, 0, timeZone) }
}

/** The period a preset means today. Custom needs both days and falls back to this month without them. */
export function presetPeriod(preset: PeriodPreset, timeZone: string, now: Date, custom?: { from?: string; to?: string }): Period {
  const today = zonedParts(now, timeZone)
  const monthEnd = (year: number, month: number) => dayString(year, month + 1, 0)
  if (preset === 'custom' && custom?.from && custom.to && custom.from <= custom.to) return periodOf(custom.from, custom.to, timeZone)
  if (preset === 'last_month') return periodOf(dayString(today.year, today.month - 1, 1), monthEnd(today.year, today.month - 1), timeZone)
  if (preset === 'this_quarter') {
    const first = Math.floor((today.month - 1) / 3) * 3 + 1
    return periodOf(dayString(today.year, first, 1), monthEnd(today.year, first + 2), timeZone)
  }
  if (preset === 'ytd') return periodOf(dayString(today.year, 1, 1), dayString(today.year, today.month, today.day), timeZone)
  if (preset === 'last_12_months') return periodOf(dayString(today.year, today.month - 11, 1), monthEnd(today.year, today.month), timeZone)
  return periodOf(dayString(today.year, today.month, 1), monthEnd(today.year, today.month), timeZone)
}

/** The period of the same length that ends the day before this one starts. */
export function previousPeriod(period: Period, timeZone: string): Period {
  const length = daysBetween(period.fromDay, period.toDay) + 1
  // Whole calendar months compare with the months before them, not with a 30- or 31-day window.
  const a = parseDay(period.fromDay)
  const b = parseDay(period.toDay)
  const wholeMonths = a.day === 1 && addDays(period.toDay, 1).endsWith('-01')
  if (wholeMonths) {
    const months = (b.year - a.year) * 12 + (b.month - a.month) + 1
    return periodOf(dayString(a.year, a.month - months, 1), dayString(a.year, a.month, 0), timeZone)
  }
  return periodOf(addDays(period.fromDay, -length), addDays(period.fromDay, -1), timeZone)
}

/** The last `count` calendar months ending with the current one, oldest first. */
export function monthPeriods(count: number, timeZone: string, now: Date): (Period & { label: string })[] {
  const today = zonedParts(now, timeZone)
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i
    const first = dayString(today.year, today.month - offset, 1)
    const p = parseDay(first)
    const period = periodOf(first, dayString(p.year, p.month + 1, 0), timeZone)
    return { ...period, label: new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${first}T00:00:00Z`)) }
  })
}

const within = (instant: Date | null, period: Period) => instant !== null && instant >= period.from && instant < period.to

// ── Facts ────────────────────────────────────────────────────────────────────────────────────────────

/** One booking: a call from a booking page (or a first call), or a coaching session paid with credits. */
export interface SessionFact {
  id: string
  /** The host's membership. */
  coachId: string
  /** The session format's name for coaching sessions; the page title for calls. */
  title: string
  /** The client for coaching sessions, the guest for calls. */
  who: string
  startsAt: Date
  endsAt: Date
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'expired'
  cancelledAt: Date | null
  // Calls
  priceCents: number | null
  paymentStatus: 'not_required' | 'pending' | 'paid' | 'refunded' | 'refund_failed'
  paidAt: Date | null
  stripeFeeCents: number | null
  // Coaching sessions
  periodId: string | null
  creditUnits: number | null
  attendedAt: Date | null
  creditOutcome: 'released' | 'forfeited' | null
}

/** A client's credit period with the price agreed when the package was assigned. */
export interface PeriodFact {
  id: string
  clientName: string
  /** The client's assigned coach, for attributing package payments on the cash basis. */
  clientCoachId: string | null
  packageName: string
  priceCents: number
  creditUnits: number
  paidCents: number
  /** Credits used (attended) or forfeited so far, from the ledger. */
  deliveredUnits: number
}

export interface PaymentFact {
  id: string
  periodId: string
  amountCents: number
  /** YYYY-MM-DD, as the business recorded it. */
  receivedOn: string
  method: string
}

export interface PayRate {
  membershipId: string
  /** YYYY-MM-DD. The latest rate on or before a session's day applies. */
  effectiveFrom: string
  method: PayMethod
  amountCents: number | null
  percentBps: number | null
  formatOverrides: PayFormatOverride[]
  payForfeited: boolean
}

export interface FinanceFacts {
  timeZone: string
  now: Date
  sessions: SessionFact[]
  periods: PeriodFact[]
  payments: PaymentFact[]
  rates: PayRate[]
  /** Everyone who coaches or has a pay rate, so salaried coaches with no sessions still appear. */
  coaches: { id: string; name: string }[]
}

// ── Delivery, revenue and pay ────────────────────────────────────────────────────────────────────────

export type Delivery = { at: Date; kind: 'attended' | 'forfeited' | 'call' | 'kept_call' }

/**
 * When a session counts as delivered: an attended coaching session (its end), a late cancellation that
 * forfeited the credit (when it was cancelled), or a paid call whose time has passed and whose payment
 * wasn't refunded. A paid call that was cancelled too late for a refund (`kept_call`) is revenue the
 * business kept, but not a session anyone is paid for. Anything else, including free calls and other
 * cancellations, isn't delivered.
 */
export function delivery(s: SessionFact, now: Date): Delivery | null {
  if (s.periodId) {
    if (s.attendedAt) return { at: s.endsAt, kind: 'attended' }
    if (s.status === 'cancelled' && s.creditOutcome === 'forfeited' && s.cancelledAt) return { at: s.cancelledAt, kind: 'forfeited' }
    return null
  }
  const paid = s.paymentStatus === 'paid' || s.paymentStatus === 'refund_failed'
  if (!paid || !s.priceCents || s.endsAt > now) return null
  if (s.status === 'confirmed') return { at: s.endsAt, kind: 'call' }
  return s.status === 'cancelled' ? { at: s.endsAt, kind: 'kept_call' } : null
}

/** What a session is worth: a call's price, or the package price in proportion to the credits it used. */
export function sessionValueCents(s: SessionFact, periods: Map<string, PeriodFact>) {
  if (!s.periodId) return s.priceCents ?? 0
  const period = periods.get(s.periodId)
  if (!period || !s.creditUnits || period.creditUnits <= 0) return 0
  return Math.round(period.priceCents * s.creditUnits / period.creditUnits)
}

/** The rate in effect for a coach on a calendar day, or null if none had started yet. */
export function rateOn(rates: PayRate[], coachId: string, day: string): PayRate | null {
  let found: PayRate | null = null
  for (const r of rates) {
    if (r.membershipId !== coachId || r.effectiveFrom > day) continue
    if (!found || r.effectiveFrom > found.effectiveFrom) found = r
  }
  return found
}

const sameFormat = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** What one delivered session pays its coach under a rate. Salaries are paid by the month, not per session. */
export function sessionPayCents(s: SessionFact, kind: Delivery['kind'], revenueCents: number, rate: PayRate | null) {
  if (!rate || rate.method === 'salary' || kind === 'kept_call') return 0
  if (kind === 'forfeited' && !rate.payForfeited) return 0
  if (rate.method === 'hourly') return Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 3_600_000 * (rate.amountCents ?? 0))
  if (rate.method === 'per_session') {
    const override = s.periodId ? rate.formatOverrides.find((o) => sameFormat(o.formatName, s.title)) : undefined
    return override?.amountCents ?? rate.amountCents ?? 0
  }
  return Math.round(revenueCents * (rate.percentBps ?? 0) / 10_000)
}

/**
 * Salary owed for the days of a period, up to and including today: each day earns that month's salary
 * divided by the days in the month, at the rate in effect that day. Rounded once per coach.
 */
export function salaryCents(rates: PayRate[], coachId: string, period: Period, today: string) {
  const mine = rates.filter((r) => r.membershipId === coachId)
  if (!mine.some((r) => r.method === 'salary')) return 0
  const last = period.toDay < today ? period.toDay : today
  let total = 0
  for (let day = period.fromDay; day <= last; day = addDays(day, 1)) {
    const rate = rateOn(mine, coachId, day)
    if (rate?.method !== 'salary') continue
    const p = parseDay(day)
    total += (rate.amountCents ?? 0) / new Date(Date.UTC(p.year, p.month, 0)).getUTCDate()
  }
  return Math.round(total)
}

// ── Summary ──────────────────────────────────────────────────────────────────────────────────────────

export type Basis = 'delivered' | 'cash'

export interface PayLine {
  sessionId: string
  at: Date
  title: string
  who: string
  kind: Delivery['kind']
  minutes: number
  revenueCents: number
  payCents: number
}

export interface CoachFinance {
  coachId: string
  name: string
  /** Revenue from sessions this coach hosted and delivered in the period. */
  deliveredCents: number
  /** Paid calls they hosted plus package payments from clients assigned to them. */
  cashCents: number
  payCents: number
  salaryCents: number
  sessions: number
  minutes: number
  /** The method of the rate in effect on the period's last day (or today), for the report. */
  method: PayMethod | null
  /** Delivered sessions on days with no pay rate. They count as $0. */
  unratedSessions: number
  lines: PayLine[]
}

export interface Transaction {
  at: Date
  /** YYYY-MM-DD in the business's time zone. */
  day: string
  who: string
  coach: string
  type: 'Paid call' | 'Package payment' | 'Refund'
  detail: string
  amountCents: number
  feeCents: number | null
}

export interface FinanceSummary {
  period: Period
  cash: { collectedCents: number; callsCents: number; packagesCents: number; refundsCents: number; netCents: number }
  delivered: { revenueCents: number; callsCents: number; coachingCents: number }
  coachPayCents: number
  feesCents: number
  /** Paid calls in the period whose Stripe fee hasn't been fetched. */
  feesMissing: number
  profit: Record<Basis, number>
  /** Profit ÷ revenue, or null when there's no revenue. */
  margin: Record<Basis, number | null>
  byCoach: CoachFinance[]
  /** Delivered revenue by package, with paid calls as their own row. */
  byPackage: { name: string; cents: number }[]
  transactions: Transaction[]
}

const CALL_PAID = new Set(['paid', 'refunded', 'refund_failed'])

export function summarize(facts: FinanceFacts, period: Period): FinanceSummary {
  const { timeZone, now } = facts
  const today = localDay(now, timeZone)
  const periods = new Map(facts.periods.map((p) => [p.id, p]))
  const names = new Map(facts.coaches.map((c) => [c.id, c.name]))
  const coachName = (id: string | null) => (id ? names.get(id) ?? 'Former coach' : 'Unassigned')
  const byCoach = new Map<string, CoachFinance>()
  const coach = (id: string) => {
    let c = byCoach.get(id)
    if (!c) {
      const reportDay = period.toDay < today ? period.toDay : today
      c = { coachId: id, name: coachName(id), deliveredCents: 0, cashCents: 0, payCents: 0, salaryCents: 0, sessions: 0, minutes: 0,
        method: rateOn(facts.rates, id, reportDay)?.method ?? null, unratedSessions: 0, lines: [] }
      byCoach.set(id, c)
    }
    return c
  }
  for (const c of facts.coaches) coach(c.id)

  const cash = { collectedCents: 0, callsCents: 0, packagesCents: 0, refundsCents: 0, netCents: 0 }
  const delivered = { revenueCents: 0, callsCents: 0, coachingCents: 0 }
  const byPackage = new Map<string, number>()
  const transactions: Transaction[] = []
  let feesCents = 0
  let feesMissing = 0

  for (const s of facts.sessions) {
    // Cash in and out for calls.
    if (!s.periodId && s.priceCents && CALL_PAID.has(s.paymentStatus) && within(s.paidAt, period)) {
      cash.callsCents += s.priceCents
      coach(s.coachId).cashCents += s.priceCents
      if (s.stripeFeeCents === null) feesMissing++
      else feesCents += s.stripeFeeCents
      transactions.push({ at: s.paidAt!, day: localDay(s.paidAt!, timeZone), who: s.who, coach: coachName(s.coachId), type: 'Paid call', detail: s.title, amountCents: s.priceCents, feeCents: s.stripeFeeCents })
    }
    if (!s.periodId && s.priceCents && s.paymentStatus === 'refunded' && within(s.cancelledAt, period)) {
      cash.refundsCents += s.priceCents
      coach(s.coachId).cashCents -= s.priceCents
      transactions.push({ at: s.cancelledAt!, day: localDay(s.cancelledAt!, timeZone), who: s.who, coach: coachName(s.coachId), type: 'Refund', detail: s.title, amountCents: -s.priceCents, feeCents: null })
    }
    // Delivered revenue and what the session pays.
    const d = delivery(s, now)
    if (!d || !within(d.at, period)) continue
    const revenue = sessionValueCents(s, periods)
    const rate = rateOn(facts.rates, s.coachId, localDay(d.at, timeZone))
    const pay = sessionPayCents(s, d.kind, revenue, rate)
    const minutes = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000)
    const c = coach(s.coachId)
    c.deliveredCents += revenue
    c.payCents += pay
    // A call cancelled too late for a refund brings in revenue, but nobody delivered a session.
    if (d.kind !== 'kept_call') {
      c.sessions++
      c.minutes += minutes
      if (!rate) c.unratedSessions++
    }
    c.lines.push({ sessionId: s.id, at: d.at, title: s.title, who: s.who, kind: d.kind, minutes: d.kind === 'kept_call' ? 0 : minutes, revenueCents: revenue, payCents: pay })
    delivered.revenueCents += revenue
    if (s.periodId) {
      delivered.coachingCents += revenue
      const name = periods.get(s.periodId)?.packageName ?? 'Package'
      byPackage.set(name, (byPackage.get(name) ?? 0) + revenue)
    } else {
      delivered.callsCents += revenue
      byPackage.set('Paid calls', (byPackage.get('Paid calls') ?? 0) + revenue)
    }
  }

  for (const pay of facts.payments) {
    if (pay.receivedOn < period.fromDay || pay.receivedOn > period.toDay) continue
    const p = periods.get(pay.periodId)
    cash.packagesCents += pay.amountCents
    if (p?.clientCoachId) coach(p.clientCoachId).cashCents += pay.amountCents
    const day = parseDay(pay.receivedOn)
    transactions.push({ at: zonedTime(day.year, day.month, day.day, 12 * 60, timeZone), day: pay.receivedOn, who: p?.clientName ?? 'Client', coach: coachName(p?.clientCoachId ?? null),
      type: 'Package payment', detail: `${p?.packageName ?? 'Package'} · ${pay.method.replace('_', ' ')}`, amountCents: pay.amountCents, feeCents: null })
  }
  cash.collectedCents = cash.callsCents + cash.packagesCents
  cash.netCents = cash.collectedCents - cash.refundsCents

  let coachPayCents = 0
  for (const c of byCoach.values()) {
    c.salaryCents = salaryCents(facts.rates, c.coachId, period, today)
    c.payCents += c.salaryCents
    c.lines.sort((a, b) => a.at.getTime() - b.at.getTime())
    coachPayCents += c.payCents
  }

  const profit = { delivered: delivered.revenueCents - coachPayCents - feesCents, cash: cash.netCents - coachPayCents - feesCents }
  const margin = {
    delivered: delivered.revenueCents > 0 ? profit.delivered / delivered.revenueCents : null,
    cash: cash.netCents > 0 ? profit.cash / cash.netCents : null,
  }
  return {
    period, cash, delivered, coachPayCents, feesCents, feesMissing, profit, margin,
    byCoach: [...byCoach.values()].sort((a, b) => b.deliveredCents - a.deliveredCents || a.name.localeCompare(b.name)),
    byPackage: [...byPackage].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents),
    transactions: transactions.sort((a, b) => a.at.getTime() - b.at.getTime()),
  }
}

/** Money families have paid for packages that hasn't been delivered as sessions yet (never below zero per period). */
export function prepaidCents(periods: PeriodFact[]) {
  return periods.reduce((sum, p) => {
    const deliveredValue = p.creditUnits > 0 ? Math.round(p.priceCents * Math.min(p.deliveredUnits, p.creditUnits) / p.creditUnits) : 0
    return sum + Math.max(0, p.paidCents - deliveredValue)
  }, 0)
}

/** What families still owe on their packages. */
export function owedCents(periods: PeriodFact[]) {
  return periods.reduce((sum, p) => sum + Math.max(0, p.priceCents - p.paidCents), 0)
}

/** Change from a previous value as a fraction, or null when there's nothing to compare with. */
export function change(current: number, previous: number) {
  return previous === 0 ? null : (current - previous) / Math.abs(previous)
}

// ── CSV ──────────────────────────────────────────────────────────────────────────────────────────────

/** A CSV cell: quoted when needed, and never starting with a character a spreadsheet would run as a formula. */
export function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const csv = (rows: (string | number | null | undefined)[][]) => rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'

export const dollars = (cents: number) => (cents / 100).toFixed(2)

// ── Describing rates ─────────────────────────────────────────────────────────────────────────────────

export const PAY_METHOD_LABELS: Record<PayMethod, string> = { hourly: 'Hourly', per_session: 'Per session', percent: 'Share of revenue', salary: 'Salary' }

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)

/** "$40 per hour", "$35 per session (2 formats differ)", "40% of revenue", "$3,000 per month". */
export function describeRate(rate: Pick<PayRate, 'method' | 'amountCents' | 'percentBps' | 'formatOverrides'>) {
  if (rate.method === 'percent') {
    const percent = (rate.percentBps ?? 0) / 100
    return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}% of revenue`
  }
  const amount = money(rate.amountCents ?? 0)
  if (rate.method === 'hourly') return `${amount} per hour`
  if (rate.method === 'salary') return `${amount} per month`
  const n = rate.formatOverrides.length
  return `${amount} per session${n ? ` (${n} ${n === 1 ? 'format differs' : 'formats differ'})` : ''}`
}
