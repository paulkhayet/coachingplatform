import { describe, expect, it } from 'vitest'
import { creditCancellationOutcome } from './session-policy'

describe('coaching cancellation credits', () => {
  const startsAt = new Date('2026-11-12T18:00:00Z')
  const late = new Date('2026-11-12T12:00:00Z')
  const rule = { startsAt, noticeHours: 24, late: 'forfeit' as const }

  it('releases credits at the notice cutoff and forfeits them for a late family cancellation', () => {
    expect(creditCancellationOutcome({ ...rule, by: 'guest', now: new Date('2026-11-11T18:00:00Z') })).toBe('released')
    expect(creditCancellationOutcome({ ...rule, by: 'guest', now: late })).toBe('forfeited')
  })

  it('preserves credits for business cancellations or a package that preserves late cancellations', () => {
    expect(creditCancellationOutcome({ ...rule, by: 'business', now: late })).toBe('released')
    expect(creditCancellationOutcome({ ...rule, by: 'guest', late: 'preserve', now: late })).toBe('released')
  })
})
