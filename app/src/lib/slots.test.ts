import { describe, expect, it } from 'vitest'
import { bookableStarts, formatClock, merge, openIntervals, parseClock, subtract, weeklyHoursSchema, zonedTime } from './slots'

const iso = (d: Date) => d.toISOString()
const at = (s: string) => new Date(s)
const NY = 'America/New_York'
const LA = 'America/Los_Angeles'

describe('zonedTime', () => {
  it('converts local wall time to the right instant on either side of daylight saving', () => {
    expect(iso(zonedTime(2026, 7, 14, 9 * 60, NY))).toBe('2026-07-14T13:00:00.000Z') // EDT, UTC-4
    expect(iso(zonedTime(2026, 12, 14, 9 * 60, NY))).toBe('2026-12-14T14:00:00.000Z') // EST, UTC-5
    expect(iso(zonedTime(2026, 7, 14, 9 * 60, 'America/Phoenix'))).toBe('2026-07-14T16:00:00.000Z') // no DST
  })

  it('moves a time skipped by spring-forward later, and picks the first of a repeated fall-back time', () => {
    // 2027-03-14: 2:00 a.m. EST jumps to 3:00 a.m. EDT, so 2:30 doesn't exist.
    expect(iso(zonedTime(2027, 3, 14, 2 * 60 + 30, NY))).toBe('2027-03-14T07:30:00.000Z') // 3:30 EDT
    // 2026-11-01: 1:30 a.m. happens twice; use the first (EDT).
    expect(iso(zonedTime(2026, 11, 1, 90, NY))).toBe('2026-11-01T05:30:00.000Z')
  })
})

describe('openIntervals', () => {
  const weekdays9to5 = [1, 2, 3, 4, 5].map((day) => ({ day, start: 9 * 60, end: 17 * 60 }))

  it('keeps 9:00 local on the days around a daylight-saving change', () => {
    // Fri 2026-10-30 (EDT) and Mon 2026-11-02 (EST).
    const open = openIntervals(weekdays9to5, NY, at('2026-10-30T00:00:00Z'), at('2026-11-03T00:00:00Z'))
    expect(open.map((i) => [iso(i.start), iso(i.end)])).toEqual([
      ['2026-10-30T13:00:00.000Z', '2026-10-30T21:00:00.000Z'],
      ['2026-11-02T14:00:00.000Z', '2026-11-02T22:00:00.000Z'],
    ])
  })

  it('uses the coach’s own time zone and day of week', () => {
    // Sunday 8 p.m.–midnight Pacific is Monday 03:00–07:00 UTC.
    const open = openIntervals([{ day: 0, start: 20 * 60, end: 24 * 60 }], LA, at('2026-11-08T00:00:00Z'), at('2026-11-10T00:00:00Z'))
    expect(open.map((i) => [iso(i.start), iso(i.end)])).toEqual([['2026-11-09T04:00:00.000Z', '2026-11-09T08:00:00.000Z']])
  })

  it('removes time off and clips to the requested range', () => {
    const open = openIntervals(weekdays9to5, NY, at('2026-11-09T15:00:00Z'), at('2026-11-10T00:00:00Z'), [
      { start: at('2026-11-09T17:00:00Z'), end: at('2026-11-09T18:00:00Z') }, // 12–1 p.m. lunch
    ])
    expect(open.map((i) => [iso(i.start), iso(i.end)])).toEqual([
      ['2026-11-09T15:00:00.000Z', '2026-11-09T17:00:00.000Z'],
      ['2026-11-09T18:00:00.000Z', '2026-11-09T22:00:00.000Z'],
    ])
  })
})

describe('bookableStarts', () => {
  const open = [{ start: at('2026-11-09T14:00:00Z'), end: at('2026-11-09T17:00:00Z') }] // 9–12 EST

  it('offers starts every step that fit the duration', () => {
    const starts = bookableStarts(open, { durationMinutes: 60, now: at('2026-11-01T00:00:00Z') })
    expect(starts.map(iso)).toEqual(['2026-11-09T14:00:00.000Z', '2026-11-09T14:30:00.000Z', '2026-11-09T15:00:00.000Z', '2026-11-09T15:30:00.000Z', '2026-11-09T16:00:00.000Z'])
  })

  it('skips anything that overlaps a busy time, including buffers', () => {
    const starts = bookableStarts(open, {
      durationMinutes: 60,
      bufferAfterMinutes: 15,
      busy: [{ start: at('2026-11-09T16:00:00Z'), end: at('2026-11-09T16:30:00Z') }],
      now: at('2026-11-01T00:00:00Z'),
    })
    // 14:30 + 60 + 15 = 15:45, clear of 16:00. 15:00 + 75 = 16:15 overlaps. 16:30 would end at 17:30, past the window.
    expect(starts.map(iso)).toEqual(['2026-11-09T14:00:00.000Z', '2026-11-09T14:30:00.000Z'])
  })

  it('respects minimum notice', () => {
    const starts = bookableStarts(open, { durationMinutes: 60, minNoticeMinutes: 120, now: at('2026-11-09T13:30:00Z') })
    expect(starts.map(iso)).toEqual(['2026-11-09T15:30:00.000Z', '2026-11-09T16:00:00.000Z'])
  })
})

describe('interval helpers', () => {
  it('merges overlapping and touching intervals and subtracts holes', () => {
    const m = merge([
      { start: at('2026-01-01T10:00:00Z'), end: at('2026-01-01T11:00:00Z') },
      { start: at('2026-01-01T09:00:00Z'), end: at('2026-01-01T10:00:00Z') },
    ])
    expect(m.map((i) => [iso(i.start), iso(i.end)])).toEqual([['2026-01-01T09:00:00.000Z', '2026-01-01T11:00:00.000Z']])
    expect(subtract(m, [{ start: at('2026-01-01T08:00:00Z'), end: at('2026-01-01T12:00:00Z') }])).toEqual([])
  })
})

describe('weekly hours', () => {
  it('parses and formats clock times', () => {
    expect(parseClock('09:30')).toBe(570)
    expect(parseClock('24:00')).toBe(1440)
    expect(parseClock('24:30')).toBeNull()
    expect(parseClock('9am')).toBeNull()
    expect(formatClock(570)).toBe('09:30')
  })

  it('rejects windows that end before they start or overlap on the same day', () => {
    expect(weeklyHoursSchema.safeParse([{ day: 1, start: 600, end: 540 }]).success).toBe(false)
    expect(weeklyHoursSchema.safeParse([{ day: 1, start: 540, end: 720 }, { day: 1, start: 700, end: 800 }]).success).toBe(false)
    expect(weeklyHoursSchema.safeParse([{ day: 1, start: 540, end: 720 }, { day: 1, start: 780, end: 1020 }, { day: 2, start: 540, end: 720 }]).success).toBe(true)
  })
})

describe('intersect', () => {
  it('keeps only the overlap, so a business gets just the hours it is offered', async () => {
    const { intersect } = await import('./slots')
    const day = [{ start: at('2026-11-10T14:00:00Z'), end: at('2026-11-10T22:00:00Z') }] // 9–5 EST
    const offered = [
      { start: at('2026-11-10T13:00:00Z'), end: at('2026-11-10T16:00:00Z') }, // 8–11
      { start: at('2026-11-10T19:00:00Z'), end: at('2026-11-10T23:00:00Z') }, // 2–6
    ]
    expect(intersect(day, offered).map((i) => [iso(i.start), iso(i.end)])).toEqual([
      ['2026-11-10T14:00:00.000Z', '2026-11-10T16:00:00.000Z'],
      ['2026-11-10T19:00:00.000Z', '2026-11-10T22:00:00.000Z'],
    ])
    expect(intersect(day, [])).toEqual([])
  })
})
