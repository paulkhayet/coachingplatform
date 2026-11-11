import { describe, expect, it } from 'vitest'
import { availableCreditUnits, businessDate, fundedCreditUnits, servicePeriodEnd } from './credits'

describe('client credit balances', () => {
  it('funds fixed bundles proportionally and reconciles fractional rounding at full payment', () => {
    expect(fundedCreditUnits(1200, 120000, 40000)).toBe(400)
    expect(fundedCreditUnits(100, 30000, 10000)).toBe(33)
    expect(fundedCreditUnits(100, 30000, 20000)).toBe(66)
    expect(fundedCreditUnits(100, 30000, 30000)).toBe(100)
    expect(fundedCreditUnits(100, 30000, 40000)).toBe(100)
  })

  it('subtracts held, spent, forfeited and expired credits from funding', () => {
    const totals = { funded_units: 400, reserved_units: 100, used_units: 50, forfeited_units: 50, expired_units: 25 }
    expect(availableCreditUnits(totals)).toBe(175)
    expect(availableCreditUnits({ ...totals, funded_units: 0 })).toBe(0)
  })

  it('uses calendar dates across daylight saving and short months', () => {
    expect(servicePeriodEnd('2026-10-25', 2)).toBe('2026-11-08')
    expect(servicePeriodEnd('2026-01-31', null)).toBe('2026-02-28')
    expect(servicePeriodEnd('2028-01-31', null)).toBe('2028-02-29')
    expect(businessDate('America/Los_Angeles', new Date('2026-11-11T04:00:00Z'))).toBe('2026-11-10')
  })
})
