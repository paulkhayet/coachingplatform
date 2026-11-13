import { describe, expect, it } from 'vitest'
import {
  attendanceItems, buildAttention, creditItems, inquiryItems, paymentItems, problemItems, relativeTime, schedulingItems, teamItems,
  type AttentionFacts, type AttentionSession, type CreditPeriodFact, type InquiryFact,
} from './attention'

const LA = 'America/Los_Angeles'
const now = new Date('2026-11-20T20:00:00Z') // noon on 20 Nov in Los Angeles
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000)

const inquiry = (over: Partial<InquiryFact> = {}): InquiryFact => ({ id: 'i1', studentName: 'Maya', stage: 'new', createdAt: hours(-30), nextAction: null, nextActionDue: null, ...over })
const period = (over: Partial<CreditPeriodFact> = {}): CreditPeriodFact => ({
  id: 'p1', clientId: 'c1', clientName: 'Maya', name: 'Eight-week bundle', startsOn: '2026-11-01', endsOn: '2026-12-27', priceCents: 80000, paidCents: 80000,
  creditUnits: 800, reservedUnits: 100, usedUnits: 200, forfeitedUnits: 0, expiredUnits: 0, ...over,
})
const session = (over: Partial<AttentionSession> = {}): AttentionSession => ({
  id: 's1', clientId: 'c1', who: 'Maya', title: 'Standard session', startsAt: hours(72), endsAt: hours(73), status: 'confirmed', attendedAt: null,
  creditCoveredAt: hours(-100), unpaidCancellationHours: null, calendarSyncError: null, meetingError: null, paymentStatus: 'not_required', cancelledAt: null, ...over,
})
const facts = (over: Partial<AttentionFacts> = {}): AttentionFacts => ({ timeZone: LA, now, inquiries: [], periods: [], sessions: [], coaches: [], ...over })
const keys = (items: { key: string }[]) => items.map((i) => i.key)

describe('inquiries', () => {
  it('flags a new inquiry only after a full day without a move', () => {
    expect(keys(inquiryItems(facts({ inquiries: [inquiry({ createdAt: hours(-24) })] })))).toEqual([])
    expect(keys(inquiryItems(facts({ inquiries: [inquiry({ createdAt: new Date(hours(-24).getTime() - 1) })] })))).toEqual(['new:i1'])
    expect(keys(inquiryItems(facts({ inquiries: [inquiry({ stage: 'matching' })] })))).toEqual([])
  })
  it('flags a next action once its day has passed in the business time zone', () => {
    const due = (day: string, stage: InquiryFact['stage'] = 'offer') => keys(inquiryItems(facts({ inquiries: [inquiry({ stage, nextAction: 'Send pricing', nextActionDue: day })] })))
    expect(due('2026-11-20')).toEqual([]) // due today
    expect(due('2026-11-19')).toEqual(['overdue:i1'])
    expect(due('2026-11-19', 'lost')).toEqual([])
    expect(due('2026-11-19', 'enrolled')).toEqual([])
    // 05:00 UTC on the 21st is still the 20th in Los Angeles.
    expect(keys(inquiryItems(facts({ now: new Date('2026-11-21T05:00:00Z'), inquiries: [inquiry({ stage: 'offer', nextActionDue: '2026-11-20' })] })))).toEqual([])
  })
})

describe('payments', () => {
  it('flags unpaid reservations whose cutoff is within 48 hours', () => {
    const unpaid = (start: number) => session({ creditCoveredAt: null, unpaidCancellationHours: 24, startsAt: hours(start), endsAt: hours(start + 1) })
    expect(keys(paymentItems(facts({ sessions: [unpaid(72)] })))).toEqual(['cutoff:s1']) // cutoff in exactly 48 hours
    expect(keys(paymentItems(facts({ sessions: [unpaid(73)] })))).toEqual([])
    expect(keys(paymentItems(facts({ sessions: [session({ unpaidCancellationHours: 24 })] })))).toEqual([]) // covered
    expect(keys(paymentItems(facts({ sessions: [{ ...unpaid(30), status: 'cancelled' }] })))).toEqual([])
  })
  it('flags packages with money owed', () => {
    const items = paymentItems(facts({ periods: [period({ paidCents: 65000 }), period({ id: 'p2' })] }))
    expect(items.map((i) => [i.key, i.title])).toEqual([['owed:p1', '$150 owed on Eight-week bundle']])
  })
})

describe('credits', () => {
  it('flags unused credits in periods ending within 14 days', () => {
    const ending = (endsOn: string, over: Partial<CreditPeriodFact> = {}) => keys(creditItems(facts({ periods: [period({ endsOn, ...over })] }))).filter((k) => k.startsWith('expiring'))
    expect(ending('2026-12-04')).toEqual(['expiring:p1']) // 14 days out
    expect(ending('2026-12-05')).toEqual([])
    expect(ending('2026-11-20')).toEqual([]) // already over: the last day was the 19th
    expect(ending('2026-12-01', { usedUnits: 700 })).toEqual([]) // nothing left to lose
  })
  it('flags active clients with one credit or less to book', () => {
    const low = (over: Partial<CreditPeriodFact>) => creditItems(facts({ periods: [period(over)] })).filter((i) => i.key.startsWith('low')).map((i) => i.title)
    expect(low({ usedUnits: 600 })).toEqual(['1 credit left'])
    expect(low({ usedUnits: 650 })).toEqual(['0.50 credits left'])
    expect(low({ usedUnits: 700 })).toEqual(['No credits left'])
    expect(low({ usedUnits: 500 })).toEqual([])
    // A renewal that hasn't started yet still counts as credits to book.
    const renewed = [period({ usedUnits: 700 }), period({ id: 'p2', startsOn: '2026-12-27', endsOn: '2027-02-21', reservedUnits: 0, usedUnits: 0 })]
    expect(creditItems(facts({ periods: renewed })).filter((i) => i.key.startsWith('low'))).toEqual([])
    // Someone with a recent session but no current period has run out.
    const past = session({ startsAt: hours(-48), endsAt: hours(-47), attendedAt: hours(-47) })
    expect(keys(creditItems(facts({ sessions: [past], periods: [period({ endsOn: '2026-11-15' })] })))).toEqual(['low:c1'])
  })
})

describe('scheduling and attendance', () => {
  it('flags active clients with nothing booked', () => {
    expect(keys(schedulingItems(facts({ periods: [period()] })))).toEqual(['idle:c1'])
    expect(keys(schedulingItems(facts({ periods: [period()], sessions: [session()] })))).toEqual([])
    expect(keys(schedulingItems(facts({ periods: [period()], sessions: [session({ status: 'cancelled' })] })))).toEqual(['idle:c1'])
    // Not active: the period is over and the last session was more than 30 days ago.
    const old = session({ startsAt: hours(-31 * 24), endsAt: hours(-31 * 24 + 1) })
    expect(keys(schedulingItems(facts({ periods: [period({ endsOn: '2026-11-01' })], sessions: [old] })))).toEqual([])
  })
  it('flags covered sessions with no outcome two days after they ended', () => {
    const ended = (h: number, over: Partial<AttentionSession> = {}) => keys(attendanceItems(facts({ sessions: [session({ startsAt: hours(h - 1), endsAt: hours(h), ...over })] })))
    expect(ended(-48)).toEqual([])
    expect(ended(-49)).toEqual(['attendance:s1'])
    expect(ended(-49, { attendedAt: hours(-48) })).toEqual([])
    expect(ended(-49, { status: 'cancelled' })).toEqual([])
    expect(ended(-49, { creditCoveredAt: null })).toEqual([])
    expect(ended(-49, { clientId: null })).toEqual([]) // calls have no attendance
  })
})

describe('errors and team', () => {
  it('flags upcoming bookings with calendar or Zoom errors, and failed refunds', () => {
    expect(keys(problemItems(facts({ sessions: [session({ calendarSyncError: 'x', meetingError: 'y' })] })))).toEqual(['calendar:s1', 'meeting:s1'])
    expect(keys(problemItems(facts({ sessions: [session({ calendarSyncError: 'x', startsAt: hours(-3), endsAt: hours(-2) })] })))).toEqual([])
    expect(keys(problemItems(facts({ sessions: [session({ clientId: null, status: 'cancelled', paymentStatus: 'refund_failed', cancelledAt: hours(-5) })] })))).toEqual(['refund:s1'])
  })
  it('flags coaches without saved hours or with a broken calendar connection', () => {
    const coaches = [{ id: 'a', name: 'Ana', hasHours: false, calendar: null }, { id: 'b', name: 'Ben', hasHours: true, calendar: 'needs_reconnect' as const }, { id: 'c', name: 'Cy', hasHours: true, calendar: 'active' as const }]
    expect(keys(teamItems(facts({ coaches })))).toEqual(['hours:a', 'google:b'])
  })
})

describe('the queue', () => {
  it('groups items in a fixed order, soonest first, keeping empty groups', () => {
    const groups = buildAttention(facts({
      inquiries: [inquiry(), inquiry({ id: 'i2', createdAt: hours(-60) })],
      periods: [period({ paidCents: 0 })],
    }))
    expect(groups.map((g) => [g.kind, keys(g.items)])).toEqual([
      ['inquiry', ['new:i2', 'new:i1']], ['payment', ['owed:p1']], ['credits', []], ['scheduling', ['idle:c1']], ['attendance', []], ['problem', []], ['team', []],
    ])
  })
  it('describes times relative to now', () => {
    expect(relativeTime(hours(-72), now)).toBe('3 days ago')
    expect(relativeTime(hours(5), now)).toBe('in 5 hours')
    expect(relativeTime(hours(-1), now)).toBe('1 hour ago')
    expect(relativeTime(new Date(now.getTime() + 20_000), now)).toBe('in 1 minute')
  })
})
