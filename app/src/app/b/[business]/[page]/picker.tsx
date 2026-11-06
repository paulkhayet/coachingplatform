'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { groupByDay } from '@/lib/booking/schemas'
import { cn } from '@/lib/utils'
import type { GuestBookingState } from './actions'

const DAYS_SHOWN = 14

export function SlotPicker({ starts, durationMinutes, action }: { starts: string[]; durationMinutes: number; action: (prev: GuestBookingState, fd: FormData) => Promise<GuestBookingState> }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<GuestBookingState, FormData>(action, {})
  // The guest's own time zone, known only in the browser. Render nothing time-specific until then.
  const [tz, setTz] = useState<string | null>(null)
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), [])

  const days = useMemo(() => (tz ? [...groupByDay(starts, tz)] : []), [starts, tz])
  const [dayIndex, setDayIndex] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)

  // If the time was taken meanwhile, reload the open times and go back to picking.
  useEffect(() => {
    if (state.taken) {
      setChosen(null)
      router.refresh()
    }
  }, [state, router])

  if (!tz) return <p className="text-muted-foreground text-sm">Loading times…</p>

  const dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' })
  const longDay = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' })
  const timeLabel = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  const zoneName = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? tz
  const current = days[Math.min(dayIndex, days.length - 1)]

  if (chosen) {
    const start = new Date(chosen)
    const end = new Date(start.getTime() + durationMinutes * 60_000)
    return (
      <form action={formAction} className="grid gap-4" noValidate>
        <button type="button" onClick={() => setChosen(null)} className="text-muted-foreground flex items-center gap-1 justify-self-start text-sm hover:underline"><ArrowLeft className="size-4" /> Change time</button>
        <div>
          <p className="font-medium">{longDay.format(start)}</p>
          <p className="text-muted-foreground text-sm">{timeLabel.format(start)} – {timeLabel.format(end)} · {zoneName}</p>
        </div>
        {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
        <input type="hidden" name="start" value={chosen} />
        <input type="hidden" name="timezone" value={tz} />
        {/* Hidden from people; bots that fill every field are rejected. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <div className="grid gap-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" aria-invalid={!!state.errors?.name} autoFocus />
          {state.errors?.name && <p className="text-destructive text-xs">{state.errors.name}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!state.errors?.email} />
          {state.errors?.email ? <p className="text-destructive text-xs">{state.errors.email}</p> : <p className="text-muted-foreground text-xs">We’ll send the calendar invitation here.</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="notes">Anything you’d like to share? <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <textarea id="notes" name="notes" rows={3} maxLength={2000} className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]" />
        </div>
        <Button type="submit" disabled={pending}>{pending ? 'Booking…' : 'Confirm booking'}</Button>
      </form>
    )
  }

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-xs">Times are in {zoneName}.</p>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
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
            <Button key={s} type="button" variant="outline" onClick={() => setChosen(s)}>{timeLabel.format(new Date(s))}</Button>
          ))}
        </div>
      )}
    </div>
  )
}
