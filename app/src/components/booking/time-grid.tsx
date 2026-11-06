'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { groupByDay } from '@/lib/booking/schemas'
import { cn } from '@/lib/utils'

const DAYS_SHOWN = 14

/** The viewer's own time zone, known only in the browser (null until mounted). */
export function useGuestTimezone() {
  const [tz, setTz] = useState<string | null>(null)
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), [])
  return tz
}

export function zoneName(tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? tz
}

/** Days across the top, that day's open times below. Calls onPick with the chosen ISO start. */
export function TimeGrid({ starts, tz, onPick }: { starts: string[]; tz: string; onPick: (iso: string) => void }) {
  const days = useMemo(() => [...groupByDay(starts, tz)], [starts, tz])
  const [dayIndex, setDayIndex] = useState(0)
  const dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' })
  const timeLabel = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  const current = days[Math.min(dayIndex, days.length - 1)]
  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-xs">Times are in {zoneName(tz)}.</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.slice(0, DAYS_SHOWN).map(([key, list], i) => (
          <button
            key={key}
            type="button"
            onClick={() => setDayIndex(i)}
            className={cn('shrink-0 rounded-md border px-3 py-2 text-sm transition-colors', i === dayIndex ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50')}
          >
            {dayLabel.format(new Date(list[0]))}
          </button>
        ))}
      </div>
      {current && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {current[1].map((s) => (
            <Button key={s} type="button" variant="outline" onClick={() => onPick(s)}>{timeLabel.format(new Date(s))}</Button>
          ))}
        </div>
      )}
    </div>
  )
}
