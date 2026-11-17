'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { FamilyCancelState, FamilyTimesState } from './actions'

const selectClass = 'bg-background border-input focus-visible:ring-ring dark:bg-input/30 h-9 w-full min-w-0 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'

/** Submits by hand, so the form keeps every choice on screen while the times load. */
function manualSubmit(event: FormEvent<HTMLFormElement>, submit: (data: FormData) => void) {
  event.preventDefault()
  const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter)
  startTransition(() => submit(data))
}

/** Open times as buttons: pick one, then confirm. */
function TimeChoices({ slots, timeZone, value, onChange }: { slots: string[]; timeZone: string; value: string; onChange: (v: string) => void }) {
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Open times</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((s) => (
          <label key={s} className={cn('cursor-pointer rounded-md border px-2 py-2 text-center text-sm tabular-nums transition-colors', value === s ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted/60')}>
            <input type="radio" name="startsAt" value={s} checked={value === s} onChange={() => onChange(s)} className="sr-only" />
            {time.format(new Date(s))}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export interface BookPeriod { id: string; name: string; startsOn: string; endsOn: string; availableLabel: string; formats: { index: number; label: string }[] }

/** Book a session with the student's coach: what, which day, then an open time. */
export function FamilyBookForm({ action, periods, timeZone, today }: { action: (s: FamilyTimesState, d: FormData) => Promise<FamilyTimesState>; periods: BookPeriod[]; timeZone: string; today: string }) {
  const [state, submit, pending] = useActionState(action, {})
  const [periodId, setPeriodId] = useState(periods[0].id)
  const period = periods.find((p) => p.id === periodId) ?? periods[0]
  const [formatIndex, setFormatIndex] = useState(String(period.formats[0].index))
  const [day, setDay] = useState(today > period.startsOn ? today : period.startsOn)
  const [startsAt, setStartsAt] = useState('')
  const current = state.day === day && state.choice?.periodId === periodId && String(state.choice?.formatIndex) === formatIndex
  const lastDay = new Date(`${period.endsOn}T00:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() - 1)
  return (
    <form onSubmit={(event) => manualSubmit(event, submit)} className="grid gap-4">
      {periods.length > 1 ? (
        <div className="grid gap-1.5">
          <Label htmlFor="periodId">Package</Label>
          <select id="periodId" name="periodId" value={periodId} onChange={(ev) => { const next = periods.find((p) => p.id === ev.target.value)!; setPeriodId(next.id); setFormatIndex(String(next.formats[0].index)); setStartsAt('') }} className={selectClass}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.availableLabel}</option>)}
          </select>
        </div>
      ) : <input type="hidden" name="periodId" value={periodId} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="formatIndex">Session</Label>
          <select id="formatIndex" name="formatIndex" value={formatIndex} onChange={(ev) => { setFormatIndex(ev.target.value); setStartsAt('') }} className={selectClass}>
            {period.formats.map((f) => <option key={f.index} value={f.index}>{f.label}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="day">Date</Label>
          <Input id="day" name="day" type="date" value={day} min={today > period.startsOn ? today : period.startsOn} max={lastDay.toISOString().slice(0, 10)} onChange={(ev) => { setDay(ev.target.value); setStartsAt('') }} required />
        </div>
      </div>
      <Button type="submit" name="intent" value="times" variant="outline" className="justify-self-start" disabled={pending}>{pending && !startsAt ? 'Looking…' : 'Find open times'}</Button>
      {current && state.slots && state.slots.length > 0 && (
        <>
          <TimeChoices slots={state.slots} timeZone={timeZone} value={startsAt} onChange={setStartsAt} />
          <Button type="submit" name="intent" value="book" className="justify-self-start" disabled={pending || !startsAt}>{pending ? 'Booking…' : 'Book this time'}</Button>
        </>
      )}
      {state.message && <Alert variant={current && state.slots?.length === 0 ? 'info' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
    </form>
  )
}

/** Move a session to another open time with the same coach. */
export function FamilyMoveForm({ action, timeZone, today, endsOn }: { action: (s: FamilyTimesState, d: FormData) => Promise<FamilyTimesState>; timeZone: string; today: string; endsOn: string }) {
  const [state, submit, pending] = useActionState(action, {})
  const [day, setDay] = useState(today)
  const [startsAt, setStartsAt] = useState('')
  const lastDay = new Date(`${endsOn}T00:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() - 1)
  return (
    <form onSubmit={(event) => manualSubmit(event, submit)} className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="move-day">New date</Label>
          <Input id="move-day" name="day" type="date" value={day} min={today} max={lastDay.toISOString().slice(0, 10)} onChange={(ev) => { setDay(ev.target.value); setStartsAt('') }} className="w-44" required />
        </div>
        <Button type="submit" name="intent" value="times" variant="outline" disabled={pending}>{pending && !startsAt ? 'Looking…' : 'Find open times'}</Button>
      </div>
      {state.day === day && state.slots && state.slots.length > 0 && (
        <>
          <TimeChoices slots={state.slots} timeZone={timeZone} value={startsAt} onChange={setStartsAt} />
          <Button type="submit" name="intent" value="move" className="justify-self-start" disabled={pending || !startsAt}>{pending ? 'Moving…' : 'Move to this time'}</Button>
        </>
      )}
      {state.message && <Alert variant={state.day === day && state.slots?.length === 0 ? 'info' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
    </form>
  )
}

/** Cancel, with what happens to the credit said up front and a second click to confirm. */
export function FamilyCancelForm({ action, outcome, warning }: { action: (s: FamilyCancelState, d: FormData) => Promise<FamilyCancelState>; outcome: 'released' | 'forfeited'; warning: string }) {
  const [state, submit, pending] = useActionState(action, {})
  const [sure, setSure] = useState(false)
  return (
    <form action={submit} className="grid gap-3">
      <input type="hidden" name="expectedOutcome" value={outcome} />
      <p className={cn('text-sm', outcome === 'forfeited' ? 'text-warning' : 'text-muted-foreground')}>{warning}</p>
      {!sure ? (
        <Button type="button" variant="outline" className="justify-self-start" onClick={() => setSure(true)}>Cancel this session</Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="destructive" disabled={pending}>{pending ? 'Cancelling…' : 'Yes, cancel it'}</Button>
          <Button type="button" variant="ghost" onClick={() => setSure(false)}>Keep it</Button>
        </div>
      )}
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
    </form>
  )
}
