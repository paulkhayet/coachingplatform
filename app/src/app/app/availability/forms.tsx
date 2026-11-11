'use client'

import { useActionState, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { US_TIME_ZONES } from '@/lib/validation'
import { MINUTES_PER_DAY, WEEKDAYS, formatClock, parseClock } from '@/lib/slots'
import type { WeeklyWindow } from '@/db/schema'
import { addTimeOff, saveAvailability, saveBusinessOffer, type AvailabilityState } from './actions'

const selectClass =
  'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

// Monday first, the way most people read a work week.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type Row = { start: string; end: string }

export function useDays(initial: WeeklyWindow[]) {
  const [days, setDays] = useState<Record<number, Row[]>>(() => {
    const out: Record<number, Row[]> = {}
    for (const w of initial) (out[w.day] ??= []).push({ start: formatClock(w.start), end: w.end === MINUTES_PER_DAY ? '24:00' : formatClock(w.end) })
    return out
  })
  const update = (day: number, rows: Row[]) => setDays((d) => ({ ...d, [day]: rows }))
  const weekly: WeeklyWindow[] = DAY_ORDER.flatMap((day) =>
    (days[day] ?? []).map((r) => ({ day, start: parseClock(r.start) ?? -1, end: parseClock(r.end === '00:00' ? '24:00' : r.end) ?? -1 })),
  )
  return { days, update, weekly }
}

/** One row per weekday with any number of time ranges. */
export function DayRows({ days, update, offLabel = 'Unavailable' }: { days: Record<number, Row[]>; update: (day: number, rows: Row[]) => void; offLabel?: string }) {
  return (
    <div className="divide-y rounded-lg border">
      {DAY_ORDER.map((day) => {
        const rows = days[day] ?? []
        const on = rows.length > 0
        return (
          <div key={day} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
            <label className="flex w-32 shrink-0 items-center gap-2 pt-1.5 text-sm font-medium">
              <input type="checkbox" className="accent-primary size-4" checked={on} onChange={(e) => update(day, e.target.checked ? [{ start: '09:00', end: '17:00' }] : [])} />
              {WEEKDAYS[day]}
            </label>
            <div className="grid flex-1 gap-2">
              {!on && <span className="text-muted-foreground pt-1.5 text-sm">{offLabel}</span>}
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="time" step={900} value={r.start} aria-label={`${WEEKDAYS[day]} start`} className="w-32" onChange={(e) => update(day, rows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="time" step={900} value={r.end === '24:00' ? '00:00' : r.end} aria-label={`${WEEKDAYS[day]} end`} className="w-32" onChange={(e) => update(day, rows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove these hours" onClick={() => update(day, rows.filter((_, j) => j !== i))}><X /></Button>
                </div>
              ))}
              {on && (
                <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => update(day, [...rows, { start: '13:00', end: '17:00' }])}>
                  <Plus /> Add hours
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function WeeklyHoursForm({ initial, timezone, saved }: { initial: WeeklyWindow[]; timezone: string; saved: boolean }) {
  const [state, action, pending] = useActionState<AvailabilityState, FormData>(saveAvailability, {})
  const { days, update, weekly } = useDays(initial)
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="weekly" value={JSON.stringify(weekly)} />
      {state.message && (
        <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>
      )}
      {!saved && !state.ok && (
        <Alert variant="info"><AlertDescription>You’re using the default hours, weekdays 9 to 5, so families can already book you. Change them below and save if they don’t suit you.</AlertDescription></Alert>
      )}
      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor="timezone">Your time zone</Label>
        <select id="timezone" name="timezone" defaultValue={timezone} className={selectClass}>
          {US_TIME_ZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <DayRows days={days} update={update} />
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save hours'}</Button>
    </form>
  )
}

/** Your hours for one business (D-059): your default hours, or separate hours just for this business. */
export function BusinessOfferForm({ businessName, offered, personal, calendars, destination, openingNote }: { businessName: string; offered: WeeklyWindow[] | null; personal: WeeklyWindow[]; calendars: { id: string; name: string; primary: boolean; owned: boolean }[] | null; destination: string; openingNote: string }) {
  const [state, action, pending] = useActionState<AvailabilityState, FormData>(saveBusinessOffer, {})
  const [mode, setMode] = useState<'all' | 'some'>(offered ? 'some' : 'all')
  const { days, update, weekly } = useDays(offered ?? personal)
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="weekly" value={JSON.stringify(weekly)} />
      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      <fieldset className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="all" checked={mode === 'all'} onChange={() => setMode('all')} className="accent-primary size-4" />
          Use my default hours for {businessName}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="some" checked={mode === 'some'} onChange={() => setMode('some')} className="accent-primary size-4" />
          Set different hours just for {businessName}
        </label>
      </fieldset>
      {mode === 'some' && <DayRows days={days} update={update} offLabel={`Not working for ${businessName}`} />}
      <p className="text-muted-foreground text-xs">{openingNote}</p>
      {calendars && (
        <div className="grid gap-1.5 sm:max-w-sm">
          <Label htmlFor="offer-destination">Add {businessName} bookings to</Label>
          <select id="offer-destination" name="destination" defaultValue={destination} className={selectClass}>
            <option value="">My default calendar</option>
            {calendars.filter((c) => c.owned).map((c) => <option key={c.id} value={c.id}>{c.name}{c.primary ? ' (main)' : ''}</option>)}
          </select>
        </div>
      )}
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
    </form>
  )
}

export function TimeOffForm({ timezone }: { timezone: string }) {
  const [state, action, pending] = useActionState<AvailabilityState, FormData>(addTimeOff, {})
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="timezone" value={timezone} />
      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="start">From</Label>
          <Input id="start" name="start" type="datetime-local" step={900} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="end">Until</Label>
          <Input id="end" name="end" type="datetime-local" step={900} required />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="note">Note <span className="text-muted-foreground font-normal">(optional, only you see it)</span></Label>
        <Input id="note" name="note" maxLength={200} placeholder="Vacation" />
      </div>
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>{pending ? 'Adding…' : 'Add time off'}</Button>
    </form>
  )
}
