import { describe, expect, it } from 'vitest'
import { accountFields, isLiveKey, paymentsStatus } from './payments'

const row = { disconnectedAt: null, detailsSubmitted: true, chargesEnabled: true }

describe('paymentsStatus', () => {
  it('walks a business from not connected to active', () => {
    expect(paymentsStatus(null)).toBe('not_connected')
    expect(paymentsStatus({ ...row, detailsSubmitted: false, chargesEnabled: false })).toBe('onboarding')
    expect(paymentsStatus({ ...row, chargesEnabled: false })).toBe('restricted')
    expect(paymentsStatus(row)).toBe('active')
  })

  it('treats a disconnected account as disconnected whatever Stripe last said', () => {
    expect(paymentsStatus({ ...row, disconnectedAt: new Date() })).toBe('disconnected')
  })
})

describe('accountFields', () => {
  it('copies the status flags and counts what Stripe still needs', () => {
    const fields = accountFields({
      details_submitted: true,
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { disabled_reason: 'requirements.past_due', currently_due: ['external_account', 'tos_acceptance.date'] } as never,
    })
    expect(fields).toEqual({ detailsSubmitted: true, chargesEnabled: false, payoutsEnabled: false, disabledReason: 'requirements.past_due', requirementsDue: 2 })
  })

  it('defaults sensibly when Stripe leaves fields out', () => {
    expect(accountFields({} as never)).toEqual({ detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false, disabledReason: null, requirementsDue: 0 })
  })
})

describe('isLiveKey', () => {
  it('tells live keys from test keys', () => {
    expect(isLiveKey('sk_live_abc')).toBe(true)
    expect(isLiveKey('rk_live_abc')).toBe(true)
    expect(isLiveKey('sk_test_abc')).toBe(false)
    expect(isLiveKey('')).toBe(false)
  })
})
