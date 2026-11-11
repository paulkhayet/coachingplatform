import { zonedParts, zonedTime } from '@/lib/slots'
import { businessDate } from './credits'

export function insideCreditPeriod(start: Date, durationMinutes: number, scope: { startsOn: string; endsOn: string; timezone: string }) {
  const lastMinute = new Date(start.getTime() + durationMinutes * 60_000 - 1)
  return businessDate(scope.timezone, start) >= scope.startsOn && businessDate(scope.timezone, lastMinute) < scope.endsOn
}

/** Keep the first occurrence's wall-clock time, including across a daylight saving change. */
export function weeklyCoachingDates(first: Date, count: number, timezone: string) {
  const local = zonedParts(first, timezone)
  const minutes = local.hour * 60 + local.minute
  return Array.from({ length: count }, (_, index) => {
    const date = index === 0 ? first : zonedTime(local.year, local.month, local.day + index * 7, minutes, timezone)
    const actual = zonedParts(date, timezone)
    return { startsAt: date, sameLocalTime: actual.hour * 60 + actual.minute === minutes }
  })
}
