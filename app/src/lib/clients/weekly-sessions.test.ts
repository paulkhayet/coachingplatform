import { describe, expect, it } from 'vitest'
import { insideCreditPeriod, weeklyCoachingDates } from './weekly-sessions'

describe('weekly coaching dates', () => {
  it('keeps the same local time when the UTC offset changes', () => {
    const dates = weeklyCoachingDates(new Date('2026-10-26T13:00:00Z'), 3, 'America/New_York')
    expect(dates.map((date) => date.startsAt.toISOString())).toEqual([
      '2026-10-26T13:00:00.000Z', '2026-11-02T14:00:00.000Z', '2026-11-09T14:00:00.000Z',
    ])
    expect(dates.every((date) => date.sameLocalTime)).toBe(true)
  })

  it('marks a skipped local time unavailable instead of moving the occurrence an hour', () => {
    const dates = weeklyCoachingDates(new Date('2026-03-01T07:30:00Z'), 2, 'America/New_York')
    expect(dates.map((date) => date.sameLocalTime)).toEqual([true, false])
  })

  it('checks the whole appointment against the credit period', () => {
    const period = { startsOn: '2026-11-10', endsOn: '2026-11-12', timezone: 'America/New_York' }
    expect(insideCreditPeriod(new Date('2026-11-12T04:00:00Z'), 60, period)).toBe(true)
    expect(insideCreditPeriod(new Date('2026-11-12T04:00:00Z'), 61, period)).toBe(false)
    expect(insideCreditPeriod(new Date('2026-11-10T04:59:00Z'), 60, period)).toBe(false)
  })
})
