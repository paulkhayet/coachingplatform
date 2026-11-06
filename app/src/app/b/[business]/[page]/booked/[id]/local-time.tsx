'use client'

import { useEffect, useState } from 'react'

/** Shows the booking in the viewer's own time zone (falling back to the one they booked in). */
export function LocalTime({ start, end, fallbackZone }: { start: string; end: string; fallbackZone: string }) {
  const [tz, setTz] = useState(fallbackZone)
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), [])
  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  return (
    <div>
      <p className="font-medium">{day.format(new Date(start))}</p>
      <p className="text-muted-foreground">{time.format(new Date(start))} – {time.format(new Date(end))}</p>
    </div>
  )
}
