import { describe, expect, it } from 'vitest'
import { calendarRange, layoutByDay, parseKey, shiftAnchor, toKey, visibleHours } from './calendar-view'

const LA = 'America/Los_Angeles'

describe('calendar view', () => {
  it('shows a Sunday-to-Saturday week in the time zone', () => {
    const { days, from, to } = calendarRange('week', { year: 2026, month: 11, day: 12 }, LA)
    expect(days.map(toKey)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'])
    expect(from.toISOString()).toBe('2026-11-08T08:00:00.000Z')
    expect(to.toISOString()).toBe('2026-11-15T08:00:00.000Z')
  })

  it('covers the whole month in full weeks, across a daylight-saving change', () => {
    const { days, from } = calendarRange('month', { year: 2026, month: 11, day: 20 }, LA)
    expect(toKey(days[0])).toBe('2026-11-01')
    expect(toKey(days[days.length - 1])).toBe('2026-12-05')
    expect(days.length % 7).toBe(0)
    expect(from.toISOString()).toBe('2026-11-01T07:00:00.000Z') // still daylight time at midnight Nov 1
  })

  it('moves by a week or a month, and rejects bad dates', () => {
    expect(toKey(shiftAnchor('week', { year: 2026, month: 12, day: 28 }, 1))).toBe('2027-01-04')
    expect(toKey(shiftAnchor('month', { year: 2026, month: 1, day: 15 }, -1))).toBe('2025-12-01')
    expect(parseKey('2026-02-30')).toBeNull()
    expect(parseKey('nope')).toBeNull()
  })

  it('splits events by day and puts overlapping ones side by side', () => {
    const days = calendarRange('week', { year: 2026, month: 11, day: 12 }, LA).days
    const at = (iso: string) => new Date(iso)
    const items = [
      { id: 'a', start: at('2026-11-12T17:00:00Z'), end: at('2026-11-12T18:00:00Z') }, // 9–10am
      { id: 'b', start: at('2026-11-12T17:30:00Z'), end: at('2026-11-12T18:30:00Z') }, // 9:30–10:30am
      { id: 'c', start: at('2026-11-12T19:00:00Z'), end: at('2026-11-12T20:00:00Z') }, // 11am, alone
      { id: 'd', start: at('2026-11-13T07:00:00Z'), end: at('2026-11-13T09:00:00Z') }, // 11pm–1am, crosses midnight
    ]
    const byDay = layoutByDay(items, days, LA)
    const thu = byDay.get('2026-11-12')!
    expect(thu.map((s) => [s.item.id, s.start, s.end, s.lane, s.lanes])).toEqual([
      ['a', 540, 600, 0, 2], ['b', 570, 630, 1, 2], ['c', 660, 720, 0, 1], ['d', 1380, 1440, 0, 1],
    ])
    expect(byDay.get('2026-11-13')!.map((s) => [s.item.id, s.start, s.end])).toEqual([['d', 0, 60]])
    expect(visibleHours(thu)).toEqual({ first: 8, last: 24 })
    expect(visibleHours([])).toEqual({ first: 8, last: 18 })
  })
})
