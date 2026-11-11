'use client'

import { useEffect, useState } from 'react'

/** Shows the booking in the time zone the guest booked in, or the viewer's own when none was saved. */
export function LocalTime({ start, end, zone }: { start: string; end: string; zone: string | null }) {
  const [tz, setTz] = useState(zone ?? 'UTC')
  useEffect(() => {
    if (!zone) setTz(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [zone])
  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  return (
    <div>
      <p className="font-medium">{day.format(new Date(start))}</p>
      <p className="text-muted-foreground">{time.format(new Date(start))} – {time.format(new Date(end))}</p>
    </div>
  )
}
