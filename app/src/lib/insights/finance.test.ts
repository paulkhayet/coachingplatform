import { describe, expect, it } from 'vitest'
import {
  change, csv, delivery, describeRate, localDay, monthPeriods, owedCents, periodOf, prepaidCents, presetPeriod, previousPeriod, rateOn, salaryCents,
  sessionPayCents, sessionValueCents, summarize,
  type FinanceFacts, type PayRate, type PeriodFact, type SessionFact,
} from './finance'

const LA = 'America/Los_Angeles'
const now = new Date('2026-11-20T20:00:00Z') // Friday 20 Nov, noon in Los Angeles
const november = periodOf('2026-11-01', '2026-11-30', LA)

const coaching = (over: Partial<SessionFact> = {}): SessionFact => ({
  id: 's1', coachId: 'ana', title: 'Standard session', who: 'Maya', startsAt: new Date('2026-11-10T18:00:00Z'), endsAt: new Date('2026-11-10T19:00:00Z'),
  status: 'confirmed', cancelledAt: null, priceCents: null, paymentStatus: 'not_required', paidAt: null, stripeFeeCents: null,
  periodId: 'p1', creditUnits: 100, attendedAt: new Date('2026-11-10T19:05:00Z'), creditOutcome: null, ...over,
})
const call = (over: Partial<SessionFact> = {}): SessionFact => ({
  id: 'c1', coachId: 'ben', title: 'Consultation', who: 'Sam Guest', startsAt: new Date('2026-11-12T18:00:00Z'), endsAt: new Date('2026-11-12T18:30:00Z'),
  status: 'confirmed', cancelledAt: null, priceCents: 5000, paymentStatus: 'paid', paidAt: new Date('2026-11-05T18:00:00Z'), stripeFeeCents: 175,
  periodId: null, creditUnits: null, attendedAt: null, creditOutcome: null, ...over,
})
const period = (over: Partial<PeriodFact> = {}): PeriodFact => ({
  id: 'p1', clientName: 'Maya', clientCoachId: 'ana', packageName: 'Eight-week bundle', priceCents: 80000, creditUnits: 800, paidCents: 40000, deliveredUnits: 100, ...over,
})
const rate = (over: Partial<PayRate> = {}): PayRate => ({
  membershipId: 'ana', effectiveFrom: '2026-01-01', method: 'hourly', amountCents: 4000, percentBps: null, formatOverrides: [], payForfeited: true, ...over,
})
const facts = (over: Partial<FinanceFacts> = {}): FinanceFacts => ({
  timeZone: LA, now, sessions: [coaching(), call()], periods: [period()], payments: [], rates: [rate(), rate({ membershipId: 'ben', method: 'per_session', amountCents: 2500 })],
  coaches: [{ id: 'ana', name: 'Ana' }, { id: 'ben', name: 'Ben' }], ...over,
})

describe('periods', () => {
  it('starts and ends at local midnight in the business time zone, across a clock change', () => {
    // 1 Nov 2026 is the day Pacific time falls back, so the month is an hour longer than 30 days.
    expect(november.from.toISOString()).toBe('2026-11-01T07:00:00.000Z')
    expect(november.to.toISOString()).toBe('2026-12-01T08:00:00.000Z')
    expect(localDay(new Date('2026-12-01T07:59:59Z'), LA)).toBe('2026-11-30')
    expect(localDay(new Date('2026-12-01T08:00:00Z'), LA)).toBe('2026-12-01')
  })
  it('resolves presets from today in the business time zone', () => {
    // 05:00 UTC on 1 Dec is still 30 Nov in Los Angeles.
    const late = new Date('2026-12-01T05:00:00Z')
    expect(presetPeriod('this_month', LA, late)).toMatchObject({ fromDay: '2026-11-01', toDay: '2026-11-30' })
    expect(presetPeriod('last_month', LA, late)).toMatchObject({ fromDay: '2026-10-01', toDay: '2026-10-31' })
    expect(presetPeriod('this_quarter', LA, late)).toMatchObject({ fromDay: '2026-10-01', toDay: '2026-12-31' })
    expect(presetPeriod('ytd', LA, late)).toMatchObject({ fromDay: '2026-01-01', toDay: '2026-11-30' })
    expect(presetPeriod('last_12_months', LA, late)).toMatchObject({ fromDay: '2025-12-01', toDay: '2026-11-30' })
    expect(presetPeriod('last_month', LA, new Date('2026-01-15T20:00:00Z'))).toMatchObject({ fromDay: '2025-12-01', toDay: '2025-12-31' })
    expect(presetPeriod('custom', LA, late, { from: '2026-02-10', to: '2026-02-20' })).toMatchObject({ fromDay: '2026-02-10', toDay: '2026-02-20' })
    expect(presetPeriod('custom', LA, late, { from: '2026-02-20', to: '2026-02-10' })).toMatchObject({ fromDay: '2026-11-01' })
  })
  it('compares whole months with the months before, and other ranges with the same number of days', () => {
    expect(previousPeriod(november, LA)).toMatchObject({ fromDay: '2026-10-01', toDay: '2026-10-31' })
    expect(previousPeriod(periodOf('2026-10-01', '2026-12-31', LA), LA)).toMatchObject({ fromDay: '2026-07-01', toDay: '2026-09-30' })
    expect(previousPeriod(periodOf('2026-03-01', '2026-03-31', LA), LA)).toMatchObject({ fromDay: '2026-02-01', toDay: '2026-02-28' })
    expect(previousPeriod(periodOf('2026-11-10', '2026-11-16', LA), LA)).toMatchObject({ fromDay: '2026-11-03', toDay: '2026-11-09' })
  })
  it('lists the last months oldest first', () => {
    const months = monthPeriods(3, LA, now)
    expect(months.map((m) => m.fromDay)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
    expect(months[2].label).toBe('Nov 26')
  })
})

describe('delivered sessions', () => {
  it('counts attended sessions, forfeited late cancellations and paid calls that ended', () => {
    expect(delivery(coaching(), now)).toEqual({ at: new Date('2026-11-10T19:00:00Z'), kind: 'attended' })
    expect(delivery(coaching({ attendedAt: null }), now)).toBeNull()
    const cancelled = coaching({ attendedAt: null, status: 'cancelled', cancelledAt: new Date('2026-11-10T10:00:00Z') })
    expect(delivery({ ...cancelled, creditOutcome: 'released' }, now)).toBeNull()
    expect(delivery({ ...cancelled, creditOutcome: 'forfeited' }, now)).toEqual({ at: new Date('2026-11-10T10:00:00Z'), kind: 'forfeited' })
    expect(delivery(call(), now)?.kind).toBe('call')
    expect(delivery(call({ endsAt: new Date('2026-11-21T18:30:00Z') }), now)).toBeNull() // not over yet
    expect(delivery(call({ paymentStatus: 'refunded', status: 'cancelled' }), now)).toBeNull()
    expect(delivery(call({ status: 'cancelled' }), now)?.kind).toBe('kept_call') // cancelled too late for a refund
    expect(delivery(call({ status: 'cancelled', endsAt: new Date('2026-11-21T18:30:00Z') }), now)).toBeNull()
    expect(delivery(call({ priceCents: null, paymentStatus: 'not_required' }), now)).toBeNull() // free call
  })
  it('values a coaching session as its share of the package price', () => {
    const periods = new Map([['p1', period()]])
    expect(sessionValueCents(coaching(), periods)).toBe(10000)
    expect(sessionValueCents(coaching({ creditUnits: 150 }), periods)).toBe(15000)
    expect(sessionValueCents(coaching({ periodId: 'gone' }), periods)).toBe(0)
    expect(sessionValueCents(call(), periods)).toBe(5000)
  })
})

describe('coach pay', () => {
  it('pays by the hour, by the session, or as a share of revenue', () => {
    const ninety = coaching({ endsAt: new Date('2026-11-10T19:30:00Z') })
    expect(sessionPayCents(ninety, 'attended', 15000, rate())).toBe(6000)
    expect(sessionPayCents(ninety, 'attended', 15000, rate({ method: 'per_session', amountCents: 3500 }))).toBe(3500)
    expect(sessionPayCents(ninety, 'attended', 15000, rate({ method: 'percent', amountCents: null, percentBps: 4000 }))).toBe(6000)
    expect(sessionPayCents(ninety, 'attended', 15000, rate({ method: 'salary', amountCents: 400000 }))).toBe(0)
    expect(sessionPayCents(ninety, 'attended', 15000, null)).toBe(0)
  })
  it('uses a per-format amount for that session format only', () => {
    const r = rate({ method: 'per_session', amountCents: 3000, formatOverrides: [{ formatName: ' standard SESSION ', amountCents: 4500 }] })
    expect(sessionPayCents(coaching(), 'attended', 10000, r)).toBe(4500)
    expect(sessionPayCents(coaching({ title: 'Short session' }), 'attended', 10000, r)).toBe(3000)
    expect(sessionPayCents(call({ title: 'Standard session' }), 'call', 5000, r)).toBe(3000) // calls aren't package formats
  })
  it('pays for a forfeited session only when the rate says so', () => {
    expect(sessionPayCents(coaching(), 'forfeited', 10000, rate())).toBe(4000)
    expect(sessionPayCents(coaching(), 'forfeited', 10000, rate({ payForfeited: false }))).toBe(0)
    expect(sessionPayCents(coaching(), 'attended', 10000, rate({ payForfeited: false }))).toBe(4000)
  })
  it('applies the rate in effect on the session’s day, so a new rate never rewrites the past', () => {
    const rates = [rate(), rate({ effectiveFrom: '2026-11-15', amountCents: 5000 }), rate({ membershipId: 'ben', effectiveFrom: '2026-11-01' })]
    expect(rateOn(rates, 'ana', '2026-11-14')?.amountCents).toBe(4000)
    expect(rateOn(rates, 'ana', '2026-11-15')?.amountCents).toBe(5000)
    expect(rateOn(rates, 'ana', '2025-12-31')).toBeNull()
    const sessions = [coaching({ id: 'before' }), coaching({ id: 'after', startsAt: new Date('2026-11-17T18:00:00Z'), endsAt: new Date('2026-11-17T19:00:00Z'), attendedAt: new Date('2026-11-17T19:00:00Z') })]
    const s = summarize(facts({ sessions, rates }), november)
    expect(s.byCoach.find((c) => c.coachId === 'ana')?.lines.map((l) => l.payCents)).toEqual([4000, 5000])
    expect(s.coachPayCents).toBe(9000)
  })
  it('prorates a salary by days, stops at today and follows a mid-month change', () => {
    const salary = [rate({ method: 'salary', amountCents: 300000 })]
    expect(salaryCents(salary, 'ana', periodOf('2026-10-01', '2026-10-31', LA), '2026-11-20')).toBe(300000)
    expect(salaryCents(salary, 'ana', november, '2026-11-20')).toBe(200000) // 20 of 30 days
    expect(salaryCents(salary, 'ana', periodOf('2026-10-16', '2026-11-15', LA), '2026-11-20')).toBe(Math.round(300000 * 16 / 31 + 300000 * 15 / 30))
    const raised = [...salary, rate({ method: 'salary', amountCents: 360000, effectiveFrom: '2026-10-16' })]
    expect(salaryCents(raised, 'ana', periodOf('2026-10-01', '2026-10-31', LA), '2026-11-20')).toBe(Math.round(300000 * 15 / 31 + 360000 * 16 / 31))
    const started = [rate({ method: 'salary', amountCents: 300000, effectiveFrom: '2026-10-22' })]
    expect(salaryCents(started, 'ana', periodOf('2026-10-01', '2026-10-31', LA), '2026-11-20')).toBe(Math.round(300000 * 10 / 31))
    const switched = [...salary, rate({ method: 'hourly', effectiveFrom: '2026-10-11' })]
    expect(salaryCents(switched, 'ana', periodOf('2026-10-01', '2026-10-31', LA), '2026-11-20')).toBe(Math.round(300000 * 10 / 31))
    expect(salaryCents([rate()], 'ana', november, '2026-11-20')).toBe(0)
  })
  it('counts a coach with no pay rate as zero and flags it', () => {
    const s = summarize(facts({ rates: [] }), november)
    const ana = s.byCoach.find((c) => c.coachId === 'ana')!
    expect(ana).toMatchObject({ payCents: 0, sessions: 1, unratedSessions: 1, method: null })
    expect(s.coachPayCents).toBe(0)
  })
})

describe('summary', () => {
  it('adds up delivered revenue, coach pay, Stripe fees and profit', () => {
    const s = summarize(facts(), november)
    expect(s.delivered).toEqual({ revenueCents: 15000, callsCents: 5000, coachingCents: 10000 })
    expect(s.coachPayCents).toBe(4000 + 2500)
    expect(s.feesCents).toBe(175)
    expect(s.profit.delivered).toBe(15000 - 6500 - 175)
    expect(s.margin.delivered).toBeCloseTo(8325 / 15000)
    expect(s.byPackage).toEqual([{ name: 'Eight-week bundle', cents: 10000 }, { name: 'Paid calls', cents: 5000 }])
    expect(s.byCoach.map((c) => [c.name, c.deliveredCents, c.payCents, c.sessions, c.minutes])).toEqual([['Ana', 10000, 4000, 1, 60], ['Ben', 5000, 2500, 1, 30]])
  })
  it('counts cash when it arrives, whatever has been delivered', () => {
    const payments = [{ id: 'pay1', periodId: 'p1', amountCents: 40000, receivedOn: '2026-11-30', method: 'check' }, { id: 'pay2', periodId: 'p1', amountCents: 20000, receivedOn: '2026-12-01', method: 'cash' }]
    const s = summarize(facts({ payments }), november)
    expect(s.cash).toEqual({ collectedCents: 45000, callsCents: 5000, packagesCents: 40000, refundsCents: 0, netCents: 45000 })
    expect(s.profit.cash).toBe(45000 - 6500 - 175)
    expect(s.byCoach.find((c) => c.coachId === 'ana')?.cashCents).toBe(40000) // the client's assigned coach
    expect(s.byCoach.find((c) => c.coachId === 'ben')?.cashCents).toBe(5000)
    expect(s.transactions.map((t) => [t.day, t.type, t.amountCents])).toEqual([['2026-11-05', 'Paid call', 5000], ['2026-11-30', 'Package payment', 40000]])
  })
  it('puts a refund in the period it happened, and keeps the Stripe fee as a cost', () => {
    const refunded = call({ status: 'cancelled', paymentStatus: 'refunded', paidAt: new Date('2026-10-28T18:00:00Z'), cancelledAt: new Date('2026-11-02T18:00:00Z') })
    const october = summarize(facts({ sessions: [refunded] }), periodOf('2026-10-01', '2026-10-31', LA))
    expect(october.cash).toMatchObject({ collectedCents: 5000, refundsCents: 0, netCents: 5000 })
    expect(october.feesCents).toBe(175)
    const nov = summarize(facts({ sessions: [refunded] }), november)
    expect(nov.cash).toMatchObject({ collectedCents: 0, refundsCents: 5000, netCents: -5000 })
    expect(nov.delivered.revenueCents).toBe(0)
    expect(nov.margin.cash).toBeNull()
    // A failed refund is still money the business holds.
    expect(summarize(facts({ sessions: [{ ...refunded, paymentStatus: 'refund_failed' }] }), november).cash.refundsCents).toBe(0)
  })
  it('splits sessions at local midnight, not UTC midnight', () => {
    // 11:30 pm on 30 Nov in Los Angeles is 07:30 UTC on 1 Dec.
    const lateNight = coaching({ startsAt: new Date('2026-12-01T06:30:00Z'), endsAt: new Date('2026-12-01T07:30:00Z'), attendedAt: new Date('2026-12-01T07:31:00Z') })
    const after = new Date('2026-12-05T20:00:00Z')
    expect(summarize(facts({ sessions: [lateNight], now: after }), november).delivered.revenueCents).toBe(10000)
    expect(summarize(facts({ sessions: [lateNight], now: after }), periodOf('2026-12-01', '2026-12-31', LA)).delivered.revenueCents).toBe(0)
    const pastMidnight = coaching({ startsAt: new Date('2026-12-01T07:30:00Z'), endsAt: new Date('2026-12-01T08:30:00Z'), attendedAt: new Date('2026-12-01T08:31:00Z') })
    expect(summarize(facts({ sessions: [pastMidnight], now: after }), november).delivered.revenueCents).toBe(0)
  })
  it('counts a call cancelled too late for a refund as revenue, with no session and no pay', () => {
    const s = summarize(facts({ sessions: [call({ status: 'cancelled', cancelledAt: new Date('2026-11-12T10:00:00Z') })] }), november)
    expect(s.delivered).toEqual({ revenueCents: 5000, callsCents: 5000, coachingCents: 0 })
    expect(s.cash).toMatchObject({ collectedCents: 5000, refundsCents: 0 })
    expect(s.byCoach.find((c) => c.coachId === 'ben')).toMatchObject({ deliveredCents: 5000, payCents: 0, sessions: 0, minutes: 0, unratedSessions: 0 })
    expect(s.byCoach.find((c) => c.coachId === 'ben')?.lines).toMatchObject([{ kind: 'kept_call', revenueCents: 5000, payCents: 0 }])
    expect(s.coachPayCents).toBe(0)
  })
  it('counts paid calls with no fee on record instead of guessing', () => {
    const s = summarize(facts({ sessions: [call({ stripeFeeCents: null }), call({ id: 'c2' })] }), november)
    expect(s.feesCents).toBe(175)
    expect(s.feesMissing).toBe(1)
  })
  it('includes salaried coaches who delivered nothing', () => {
    const s = summarize(facts({ sessions: [], rates: [rate({ method: 'salary', amountCents: 300000 })] }), november)
    expect(s.byCoach.find((c) => c.coachId === 'ana')).toMatchObject({ payCents: 200000, salaryCents: 200000, sessions: 0, method: 'salary' })
    expect(s.profit.delivered).toBe(-200000)
    expect(s.margin.delivered).toBeNull()
  })
})

describe('balances', () => {
  it('counts money paid ahead of sessions, never below zero for a period', () => {
    expect(prepaidCents([period()])).toBe(40000 - 10000)
    expect(prepaidCents([period({ paidCents: 5000, deliveredUnits: 200 })])).toBe(0)
    expect(prepaidCents([period(), period({ id: 'p2', paidCents: 80000, deliveredUnits: 800 })])).toBe(30000)
  })
  it('adds up what families still owe', () => {
    expect(owedCents([period(), period({ id: 'p2', paidCents: 80000 }), period({ id: 'p3', paidCents: 0 })])).toBe(40000 + 0 + 80000)
  })
  it('reports change against the previous period', () => {
    expect(change(150, 100)).toBeCloseTo(0.5)
    expect(change(50, -100)).toBeCloseTo(1.5)
    expect(change(100, 0)).toBeNull()
  })
})

describe('csv', () => {
  it('quotes cells and defuses spreadsheet formulas', () => {
    expect(csv([['Name', 'Amount'], ['Hale, Marcus', '-45.00'], ['=HYPERLINK("x")', 12], ['Line\nbreak "q"', null]]))
      .toBe('Name,Amount\r\n"Hale, Marcus",-45.00\r\n"\'=HYPERLINK(""x"")",12\r\n"Line\nbreak ""q""",\r\n')
  })
})

describe('describing rates', () => {
  it('says what each method pays', () => {
    expect(describeRate(rate())).toBe('$40 per hour')
    expect(describeRate(rate({ method: 'per_session', amountCents: 3550, formatOverrides: [{ formatName: 'Short', amountCents: 2000 }] }))).toBe('$35.50 per session (1 format differs)')
    expect(describeRate(rate({ method: 'percent', amountCents: null, percentBps: 4250 }))).toBe('42.50% of revenue')
    expect(describeRate(rate({ method: 'salary', amountCents: 300000 }))).toBe('$3,000 per month')
  })
})
