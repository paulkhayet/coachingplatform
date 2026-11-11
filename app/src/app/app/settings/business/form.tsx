'use client'

import { startTransition, useActionState, useState } from 'react'
import { BusinessMark } from '@/components/business-mark'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WeeklyWindow } from '@/db/schema'
import { DayRows, useDays } from '../../availability/forms'
import { saveOpeningHours, type OpeningHoursState } from './actions'

const WEEKDAYS_9_TO_5: WeeklyWindow[] = [1, 2, 3, 4, 5].map((day) => ({ day, start: 540, end: 1020 }))

export function OpeningHoursForm({ initial, businessName }: { initial: WeeklyWindow[] | null; businessName: string }) {
  const [state, action, pending] = useActionState<OpeningHoursState, FormData>(saveOpeningHours, {})
  const [mode, setMode] = useState<'none' | 'some'>(initial ? 'some' : 'none')
  const { days, update, weekly } = useDays(initial ?? WEEKDAYS_9_TO_5)
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="weekly" value={JSON.stringify(weekly)} />
      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      <fieldset className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="none" checked={mode === 'none'} onChange={() => setMode('none')} className="accent-primary size-4" />
          No limit: each person’s own hours decide
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="some" checked={mode === 'some'} onChange={() => setMode('some')} className="accent-primary size-4" />
          {businessName} is only open at these times
        </label>
      </fieldset>
      {mode === 'some' && <DayRows days={days} update={update} offLabel="Closed" />}
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save opening hours'}</Button>
    </form>
  )
}

export function ReservationSettingsForm({ initial, save }: {
  initial: { enabled: boolean; reminder: number | null; cutoff: number | null }
  save: (state: OpeningHoursState, form: FormData) => Promise<OpeningHoursState>
}) {
  const [state, action, pending] = useActionState(save, {})
  const [enabled, setEnabled] = useState(initial.enabled)
  const [reminder, setReminder] = useState(initial.reminder?.toString() ?? '')
  const [cutoff, setCutoff] = useState(initial.cutoff?.toString() ?? '')
  // Submit through a transition rather than `action={...}`: React resets a form after an action prop runs,
  // which unticks the controlled checkbox on screen while its state stays on, so a second save turned it off.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(() => action(form))
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="advanceReservations" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="accent-primary size-4" />
        Allow reservations before payment
      </label>
      <div className="grid max-w-lg gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="payment-reminder-hours">Remind before session (hours)</Label>
          <Input id="payment-reminder-hours" name="paymentReminderHours" type="number" min={1} max={720} step={1}
            value={reminder} onChange={(event) => setReminder(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="unpaid-cancellation-hours">Cancel before session (hours)</Label>
          <Input id="unpaid-cancellation-hours" name="unpaidCancellationHours" type="number" min={1} max={720} step={1}
            value={cutoff} onChange={(event) => setCutoff(event.target.value)} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">Leave either field blank to turn it off. Payment reminders go to the selected client or guardian. These settings apply to new reservations.</p>
      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save reservation settings'}</Button>
    </form>
  )
}

function Feedback({ state }: { state: OpeningHoursState }) {
  return state.message ? <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert> : null
}

export function BusinessLogoForm({ name, logoUrl, save }: {
  name: string
  logoUrl: string | null
  save: (state: OpeningHoursState, form: FormData) => Promise<OpeningHoursState>
}) {
  const [state, action, pending] = useActionState(save, {})
  return (
    <form action={action} className="flex flex-wrap items-start gap-4">
      <BusinessMark name={name} logoUrl={logoUrl} className="size-16 rounded-lg text-2xl" />
      <div className="grid min-w-0 flex-1 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="business-logo">Logo</Label>
          <Input id="business-logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="business-logo-help" required />
          <p id="business-logo-help" className="text-muted-foreground text-xs">A square JPG, PNG, or WebP works best, up to 750 KB. Shown on your booking pages.</p>
        </div>
        <Feedback state={state} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={pending}>{pending ? 'Saving…' : 'Upload logo'}</Button>
          {logoUrl && <Button type="submit" name="intent" value="remove" variant="ghost" formNoValidate disabled={pending}>Remove logo</Button>}
        </div>
      </div>
    </form>
  )
}

export function BusinessProfileForm({ initial, save }: {
  initial: { about: string | null; websiteUrl: string | null; contactEmail: string | null }
  save: (state: OpeningHoursState, form: FormData) => Promise<OpeningHoursState>
}) {
  const [state, action, pending] = useActionState(save, {})
  // Submitted in a transition so React doesn't reset the fields to their old values after saving.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(() => action(form))
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="business-about">About</Label>
        <textarea id="business-about" name="about" defaultValue={initial.about ?? ''} maxLength={600} rows={4}
          placeholder="What you coach, who you work with, and what to expect."
          className="border-input bg-background focus-visible:ring-ring/50 focus-visible:border-ring rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]" />
        <p className="text-muted-foreground text-xs">Shown on your booking pages. Up to 600 characters.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="business-website">Website</Label>
          <Input id="business-website" name="websiteUrl" type="text" inputMode="url" autoComplete="url" placeholder="example.com" defaultValue={initial.websiteUrl ?? ''} maxLength={200} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="business-contact">Contact email</Label>
          <Input id="business-contact" name="contactEmail" type="email" autoComplete="email" placeholder="hello@example.com" defaultValue={initial.contactEmail ?? ''} maxLength={254} />
        </div>
      </div>
      <Feedback state={state} />
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save profile'}</Button>
    </form>
  )
}

export function BusinessNameForm({ name, save }: {
  name: string
  save: (state: OpeningHoursState, form: FormData) => Promise<OpeningHoursState>
}) {
  const [state, action, pending] = useActionState(save, {})
  const [value, setValue] = useState(name)
  return (
    <form action={action} className="grid gap-3">
      <div className="grid max-w-sm gap-1.5">
        <Label htmlFor="business-name">Business name</Label>
        <Input id="business-name" name="name" autoComplete="organization" value={value} onChange={(event) => setValue(event.target.value)}
          minLength={2} maxLength={80} required />
      </div>
      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending || name === value}>{pending ? 'Saving…' : 'Save business name'}</Button>
    </form>
  )
}
