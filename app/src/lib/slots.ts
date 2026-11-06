// Turning a coach's weekly hours into bookable times. Pure functions, so they can be unit tested.
//
// Weekly hours are wall-clock times in the coach's own time zone ("Tuesdays 9:00–17:00 Pacific"), so a
// 9:00 start stays 9:00 local across daylight-saving changes. Everything else here is in UTC instants.

import { z } from 'zod'
import type { WeeklyWindow } from '@/db/schema'

export const MINUTES_PER_DAY = 24 * 60
const MS_PER_MINUTE = 60_000

export interface Interval {
  start: Date
  end: Date
}

/** Validates weekly hours: whole minutes, start before end, no overlaps within a day. */
export const weeklyHoursSchema = z
  .array(
    z.object({
      day: z.number().int().min(0).max(6),
      start: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
      end: z.number().int().min(1).max(MINUTES_PER_DAY),
    }),
  )
  .max(70)
  .superRefine((windows, ctx) => {
    windows.forEach((w, i) => {
      if (w.end <= w.start) ctx.addIssue({ code: 'custom', path: [i], message: 'End time must be after the start time' })
    })
    for (let day = 0; day < 7; day++) {
      const sorted = windows.filter((w) => w.day === day).sort((a, b) => a.start - b.start)
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start < sorted[i - 1].end) {
          ctx.addIssue({ code: 'custom', path: [], message: `${WEEKDAYS[day]} has overlapping times` })
          break
        }
      }
    }
  })

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** Parses stored weekly hours, dropping anything malformed instead of failing the whole page. */
export function parseWeeklyHours(value: unknown): WeeklyWindow[] {
  const parsed = weeklyHoursSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}

/** "09:30" → 570. Returns null for anything that isn't HH:MM. "24:00" is allowed as an end of day. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return null
  return h * 60 + min
}

/** 570 → "09:30" (for <input type="time">). */
export function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60)
  return `${String(h).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// ── Time zone arithmetic with Intl (no extra dependency) ─────────────────────────────────────────────

const formatters = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(timeZone: string) {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    formatters.set(timeZone, f)
  }
  return f
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(instant: Date, timeZone: string) {
  const p: Record<string, number> = {}
  for (const { type, value } of partsFormatter(timeZone).formatToParts(instant)) if (type !== 'literal') p[type] = Number(value)
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second }
}

/** Minutes the time zone is ahead of UTC at that instant (e.g. -420 for Pacific daylight time). */
function offsetMinutes(instant: Date, timeZone: string) {
  const p = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / MS_PER_MINUTE)
}

/**
 * The instant at a local date and wall-clock minute in a time zone. Times skipped by a spring-forward
 * change (2:30 a.m.) move forward by the gap, as calendars do; repeated fall-back times use the first.
 */
export function zonedTime(year: number, month: number, day: number, minuteOfDay: number, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, day) + minuteOfDay * MS_PER_MINUTE
  const first = wall - offsetMinutes(new Date(wall), timeZone) * MS_PER_MINUTE
  const second = wall - offsetMinutes(new Date(first), timeZone) * MS_PER_MINUTE
  if (first === second) return new Date(first)
  // Ambiguous or skipped: prefer the earlier instant that still reads as the requested wall time.
  const candidates = [first, second].sort((a, b) => a - b)
  for (const c of candidates) {
    const p = zonedParts(new Date(c), timeZone)
    if (p.hour * 60 + p.minute === minuteOfDay % MINUTES_PER_DAY) return new Date(c)
  }
  return new Date(candidates[1])
}

/** Calendar dates (in the time zone) that overlap [from, to). */
function localDates(from: Date, to: Date, timeZone: string) {
  const dates: { year: number; month: number; day: number; weekday: number }[] = []
  const start = zonedParts(from, timeZone)
  let cursor = Date.UTC(start.year, start.month - 1, start.day)
  // Step through calendar days in UTC-as-local space; one extra day covers windows that end after `to`.
  while (zonedTime(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, new Date(cursor).getUTCDate(), 0, timeZone) < to) {
    const d = new Date(cursor)
    dates.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() })
    cursor += MINUTES_PER_DAY * MS_PER_MINUTE
  }
  return dates
}

// ── Availability ─────────────────────────────────────────────────────────────────────────────────────

/** The coach's open intervals between `from` and `to`: weekly hours minus time off, merged and clipped. */
export function openIntervals(weekly: WeeklyWindow[], timeZone: string, from: Date, to: Date, timeOff: Interval[] = []): Interval[] {
  const raw: Interval[] = []
  for (const d of localDates(from, to, timeZone)) {
    for (const w of weekly) {
      if (w.day !== d.weekday) continue
      const start = zonedTime(d.year, d.month, d.day, w.start, timeZone)
      const end = w.end === MINUTES_PER_DAY ? zonedTime(d.year, d.month, d.day + 1, 0, timeZone) : zonedTime(d.year, d.month, d.day, w.end, timeZone)
      const s = Math.max(start.getTime(), from.getTime())
      const e = Math.min(end.getTime(), to.getTime())
      if (e > s) raw.push({ start: new Date(s), end: new Date(e) })
    }
  }
  return subtract(merge(raw), timeOff)
}

export interface SlotOptions {
  /** Appointment length. */
  durationMinutes: number
  /** Gap between possible start times. Defaults to 30 minutes, or the duration if shorter. */
  stepMinutes?: number
  /** Free time required before and after each appointment, against other commitments. */
  bufferBeforeMinutes?: number
  bufferAfterMinutes?: number
  /** Nothing can be booked sooner than this after `now`. */
  minNoticeMinutes?: number
  now?: Date
  /** Other commitments: existing bookings and busy times from connected calendars. */
  busy?: Interval[]
}

/**
 * Start times a guest can book. Starts are aligned to the step from the start of each open interval in
 * local time, so a 9:00 window offers 9:00, 9:30, … whatever the date's UTC offset.
 */
export function bookableStarts(open: Interval[], opts: SlotOptions): Date[] {
  const dur = opts.durationMinutes * MS_PER_MINUTE
  const step = (opts.stepMinutes ?? Math.min(30, opts.durationMinutes)) * MS_PER_MINUTE
  const before = (opts.bufferBeforeMinutes ?? 0) * MS_PER_MINUTE
  const after = (opts.bufferAfterMinutes ?? 0) * MS_PER_MINUTE
  const earliest = (opts.now ?? new Date()).getTime() + (opts.minNoticeMinutes ?? 0) * MS_PER_MINUTE
  const busy = merge(opts.busy ?? [])
  const starts: Date[] = []
  if (dur <= 0 || step <= 0) return starts
  for (const iv of open) {
    for (let t = iv.start.getTime(); t + dur <= iv.end.getTime(); t += step) {
      if (t < earliest) continue
      const blockStart = t - before
      const blockEnd = t + dur + after
      if (busy.some((b) => b.start.getTime() < blockEnd && b.end.getTime() > blockStart)) continue
      starts.push(new Date(t))
    }
  }
  return starts
}

// ── Interval helpers ─────────────────────────────────────────────────────────────────────────────────

export function merge(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start.getTime() - b.start.getTime())
  const out: Interval[] = []
  for (const i of sorted) {
    const last = out[out.length - 1]
    if (last && i.start <= last.end) {
      if (i.end > last.end) last.end = i.end
    } else out.push({ start: new Date(i.start), end: new Date(i.end) })
  }
  return out
}

export function subtract(base: Interval[], remove: Interval[]): Interval[] {
  let result = merge(base)
  for (const r of merge(remove)) {
    const next: Interval[] = []
    for (const b of result) {
      if (r.end <= b.start || r.start >= b.end) {
        next.push(b)
        continue
      }
      if (r.start > b.start) next.push({ start: b.start, end: r.start })
      if (r.end < b.end) next.push({ start: r.end, end: b.end })
    }
    result = next
  }
  return result
}
