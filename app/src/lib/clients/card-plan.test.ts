import { describe, expect, it } from 'vitest'
import type { AssignedPackageTerms } from '@/db/schema'
import { cardOptions, describeInstalments, instalmentSplit } from './card-plan'

const terms = (over: Partial<AssignedPackageTerms> = {}): AssignedPackageTerms => ({
  name: 'Eight-week bundle', description: null, kind: 'fixed', termWeeks: 8, creditUnits: 800, sessionFormats: [{ name: 'Standard', durationMinutes: 60, creditUnits: 100 }],
  priceCents: 100000, installmentCount: 3, installmentCadence: 'monthly', eligibleCoachIds: null, cancellationNoticeHours: null,
  lateCancellation: 'inherit', expiration: 'inherit', makeupExtensionDays: null, ...over,
})
const money = (c: number) => `$${(c / 100).toFixed(2)}`

describe('instalments', () => {
  it('splits a price evenly, with leftover cents on the first payment', () => {
    expect(instalmentSplit(100000, 3)).toEqual({ each: 33333, first: 33334, extra: 1 })
    expect(instalmentSplit(80000, 4)).toEqual({ each: 20000, first: 20000, extra: 0 })
    const { each, first } = instalmentSplit(99999, 7)
    expect(first + each * 6).toBe(99999)
  })
  it('describes the plan in plain words', () => {
    expect(describeInstalments({ kind: 'instalments', count: 3, cadence: 'monthly', firstCents: 33334, eachCents: 33333 }, money)).toBe('3 monthly payments: $333.34 today, then $333.33 a month')
    expect(describeInstalments({ kind: 'instalments', count: 4, cadence: 'weekly', firstCents: 20000, eachCents: 20000 }, money)).toBe('4 weekly payments of $200.00')
  })
})

describe('what a family can choose', () => {
  it('offers the balance, and instalments when the package has them and nothing is paid yet', () => {
    expect(cardOptions({ terms: terms(), paidCents: 0, allowInstalments: true })).toEqual([
      { kind: 'full', amountCents: 100000 },
      { kind: 'instalments', count: 3, cadence: 'monthly', firstCents: 33334, eachCents: 33333 },
    ])
  })
  it('offers only the rest of the balance once something is paid, or when staff turned instalments off', () => {
    expect(cardOptions({ terms: terms(), paidCents: 40000, allowInstalments: true })).toEqual([{ kind: 'full', amountCents: 60000 }])
    expect(cardOptions({ terms: terms(), paidCents: 0, allowInstalments: false })).toEqual([{ kind: 'full', amountCents: 100000 }])
  })
  it('never offers instalments on monthly packages or packages without them', () => {
    expect(cardOptions({ terms: terms({ kind: 'monthly', termWeeks: null, installmentCount: null, installmentCadence: null }), paidCents: 0, allowInstalments: true })).toHaveLength(1)
    expect(cardOptions({ terms: terms({ installmentCount: null, installmentCadence: null }), paidCents: 0, allowInstalments: true })).toHaveLength(1)
  })
  it('offers nothing when the package is paid, or less than Stripe’s minimum is left', () => {
    expect(cardOptions({ terms: terms(), paidCents: 100000, allowInstalments: true })).toEqual([])
    expect(cardOptions({ terms: terms(), paidCents: 99960, allowInstalments: true })).toEqual([])
    expect(cardOptions({ terms: terms({ priceCents: 120, installmentCount: 3 }), paidCents: 0, allowInstalments: true })).toEqual([{ kind: 'full', amountCents: 120 }])
  })
})
