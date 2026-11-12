import { describe, expect, it } from 'vitest'
import { bestYearlySaving, formatDollars, formatPlanPrice, monthlyDollars, planFromLookupKey, planLimits, priceLookupKey, yearlyDollars } from './plans'

describe('plans', () => {
  it('limits the free plan to one person, one page and free calls', () => {
    expect(planLimits('free')).toEqual({ people: 1, bookingPages: 1, paidCalls: false, zoom: false, clients: false, reminders: false })
    expect(planLimits('solo')).toMatchObject({ people: 1, bookingPages: null, paidCalls: true, clients: true, reminders: true })
    expect(planLimits('team', 4).people).toBe(4)
    expect(planLimits('team', 0).people).toBe(1)
  })

  it('round-trips Stripe lookup keys and ignores others', () => {
    expect(planFromLookupKey(priceLookupKey('team', 'month'))).toEqual({ plan: 'team', interval: 'month' })
    expect(planFromLookupKey('something_else')).toBeNull()
    expect(planFromLookupKey(null)).toBeNull()
  })

  it('works out monthly prices and the yearly saving from the plan prices', () => {
    expect(monthlyDollars('solo', 'year')).toBe(10)
    expect(monthlyDollars('team', 'month')).toBe(17)
    expect(yearlyDollars('team')).toBe(180)
    expect(bestYearlySaving()).toBe(17)
    expect(formatDollars(12.5)).toBe('12.50')
  })

  it('shows the advertised prices (D-069)', () => {
    expect(formatPlanPrice('solo', 'year')).toBe('$10/month, billed yearly')
    expect(formatPlanPrice('solo', 'month')).toBe('$12/month')
    expect(formatPlanPrice('team', 'year')).toBe('$15/month per person, billed yearly')
    expect(formatPlanPrice('team', 'month')).toBe('$17/month per person')
  })
})
