import { MINUTES_PER_DAY, zonedParts, zonedTime, type Interval } from '@/lib/slots'

// Date math for the Bookings calendar (week and month views). Dates are calendar days in the
// business's (or person's) time zone; instants are only used for the edges of the range.

export type CalendarDisplay = 'list' | 'week' | 'month'
export interface CalDate { year: number; month: number; day: number }

export const toKey = (d: CalDate) => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`

export function parseKey(value: string | undefined): CalDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCMonth() === +m[2] - 1 ? { year: +m[1], month: +m[2], day: +m[3] } : null
}

const utc = (d: CalDate) => Date.UTC(d.year, d.month - 1, d.day)
const fromUtc = (ms: number): CalDate => { const d = new Date(ms); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() } }
export const addDays = (d: CalDate, n: number) => fromUtc(utc(d) + n * 86_400_000)
export const weekday = (d: CalDate) => new Date(utc(d)).getUTCDay()
export const sameDay = (a: CalDate, b: CalDate) => a.year === b.year && a.month === b.month && a.day === b.day

export function todayIn(timeZone: string, now = new Date()): CalDate {
  const p = zonedParts(now, timeZone)
  return { year: p.year, month: p.month, day: p.day }
}

/** The days shown, and the instants they span: a Sunday-to-Saturday week, or whole weeks covering the month. */
export function calendarRange(display: 'week' | 'month', anchor: CalDate, timeZone: string) {
  let first: CalDate
  let count: number
  if (display === 'week') {
    first = addDays(anchor, -weekday(anchor))
    count = 7
  } else {
    const start = { year: anchor.year, month: anchor.month, day: 1 }
    const last = addDays({ year: anchor.month === 12 ? anchor.year + 1 : anchor.year, month: anchor.month === 12 ? 1 : anchor.month + 1, day: 1 }, -1)
    first = addDays(start, -weekday(start))
    const end = addDays(last, 6 - weekday(last))
    count = Math.round((utc(end) - utc(first)) / 86_400_000) + 1
  }
  const days = Array.from({ length: count }, (_, i) => addDays(first, i))
  const after = addDays(first, count)
  return { days, from: zonedTime(first.year, first.month, first.day, 0, timeZone), to: zonedTime(after.year, after.month, after.day, 0, timeZone) }
}

/** The anchor for the previous or next week or month. */
export function shiftAnchor(display: 'week' | 'month', anchor: CalDate, direction: -1 | 1): CalDate {
  if (display === 'week') return addDays(anchor, 7 * direction)
  const month = anchor.month + direction
  const year = anchor.year + (month < 1 ? -1 : month > 12 ? 1 : 0)
  return { year, month: ((month + 11) % 12) + 1, day: 1 }
}

export interface DaySegment<T> { item: T; start: number; end: number; lane: number; lanes: number }

/**
 * Splits items into per-day pieces in minutes from local midnight (an event crossing midnight shows on
 * both days), and gives overlapping pieces side-by-side lanes.
 */
export function layoutByDay<T extends Interval>(items: T[], days: CalDate[], timeZone: string): Map<string, DaySegment<T>[]> {
  const out = new Map<string, DaySegment<T>[]>(days.map((d) => [toKey(d), []]))
  for (const d of days) {
    const dayStart = zonedTime(d.year, d.month, d.day, 0, timeZone)
    const next = addDays(d, 1)
    const dayEnd = zonedTime(next.year, next.month, next.day, 0, timeZone)
    const minutes = (t: Date) => Math.round((t.getTime() - dayStart.getTime()) / 60_000)
    const pieces = items.filter((i) => i.start < dayEnd && i.end > dayStart)
      .map((item) => ({ item, start: Math.max(0, minutes(item.start)), end: Math.min(minutes(dayEnd), minutes(item.end)) }))
      .sort((a, b) => a.start - b.start || b.end - a.end)
    // Greedy lanes within each cluster of overlapping pieces.
    const placed: DaySegment<T>[] = []
    let cluster: DaySegment<T>[] = []
    let clusterEnd = -1
    const close = () => { const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1)); for (const c of cluster) c.lanes = lanes; cluster = [] }
    for (const p of pieces) {
      if (p.start >= clusterEnd && cluster.length) close()
      const used = new Set(cluster.filter((c) => c.end > p.start).map((c) => c.lane))
      let lane = 0
      while (used.has(lane)) lane++
      const seg = { ...p, lane, lanes: 1 }
      cluster.push(seg)
      placed.push(seg)
      clusterEnd = Math.max(clusterEnd, p.end)
    }
    if (cluster.length) close()
    out.set(toKey(d), placed)
  }
  return out
}

/** The hours to draw in the week view: 7am to 8pm, widened to fit anything outside it. */
export function visibleHours(segments: { start: number; end: number }[]) {
  let first = 7
  let last = 20
  for (const s of segments) {
    first = Math.min(first, Math.floor(s.start / 60))
    last = Math.max(last, Math.ceil(s.end / 60))
  }
  return { first: Math.max(0, first), last: Math.min(MINUTES_PER_DAY / 60, last) }
}
