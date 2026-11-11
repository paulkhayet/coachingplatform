'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_WEEKLY_SESSIONS } from '@/lib/clients/session-policy'
import type { CoachingBookingState, CoachingMoveState, CoachingOutcomeState, WeeklyPreview } from './coaching-actions'

type Choice = { id: string; name: string }
const selectClass = 'bg-background border-input focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60'

// Date and time choices stay on screen while the server previews availability.
function submitForm(event: FormEvent<HTMLFormElement>, dispatch: (data: FormData) => void) {
  event.preventDefault()
  const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter)
  startTransition(() => dispatch(data))
}

function WeeklyDates({ preview, pending, timezone }: { preview: WeeklyPreview; pending: boolean; timezone: string }) {
  const [selected, setSelected] = useState(() => {
    const dates: string[] = []
    for (const date of preview.dates) {
      if (dates.length === preview.reservableSlots) break
      if (!date.issue && (!date.needsCoverageNow || dates.length < preview.fundedSlots)) dates.push(date.start)
    }
    return dates
  })
  const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const credits = selected.length * preview.creditUnits / 100
  const isUnfunded = (start: string) => selected.filter((date) => date < start).length >= preview.fundedSlots
  const insideCutoff = preview.dates.some((date) => date.needsCoverageNow && selected.includes(date.start) && isUnfunded(date.start))
  return (
    <fieldset disabled={pending} className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">Weekly dates</legend>
      <p className="text-muted-foreground text-sm">{selected.length} of {preview.dates.length} selected · {credits} {credits === 1 ? 'credit' : 'credits'} to reserve</p>
      <ul className="divide-y">
        {preview.dates.map((date) => {
          const checked = selected.includes(date.start)
          const atLimit = selected.length >= preview.reservableSlots
          const unpaid = isUnfunded(date.start)
          const requiresPayment = date.needsCoverageNow && unpaid
          return (
            <li key={date.start} className="py-2">
              <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" name="selectedStarts" value={date.start} checked={checked} disabled={Boolean(date.issue) || (!checked && (atLimit || requiresPayment))}
                    onChange={(e) => setSelected((current) => e.target.checked ? [...current, date.start] : current.filter((start) => start !== date.start))} className="accent-primary size-4" />
                  {dateFormat.format(new Date(date.start))}
                </span>
                <StatusBadge tone={date.issue || requiresPayment || (checked && unpaid) || (!checked && atLimit) ? 'warning' : checked ? 'success' : 'neutral'}>
                  {date.issue ?? (requiresPayment ? 'Inside payment cutoff' : checked ? (unpaid ? 'Payment needed' : 'Covered') : atLimit ? 'Credit limit reached' : 'Open')}
                </StatusBadge>
              </label>
            </li>
          )
        })}
      </ul>
      {insideCutoff && <p className="text-warning text-sm">Deselect any unpaid date inside the payment cutoff.</p>}
      <Button type="submit" name="intent" value="book-series" className="justify-self-start" disabled={pending || !selected.length || insideCutoff}>{pending ? 'Booking…' : 'Confirm selected sessions'}</Button>
    </fieldset>
  )
}

export function CoachingBookingForm({ action, formats, coaches, contacts, firstDate, lastDate, timezone, noticeHours, lateCancellation, zoomAvailable, defaultCoach }: {
  action: (state: CoachingBookingState, data: FormData) => Promise<CoachingBookingState>
  formats: Choice[]; coaches: Choice[]; contacts: Choice[]; firstDate: string; lastDate: string; timezone: string;
  noticeHours: number | null; lateCancellation: 'inherit' | 'preserve' | 'forfeit'; zoomAvailable: boolean; defaultCoach?: string;
}) {
  const [state, submit, pending] = useActionState(action, {})
  const [format, setFormat] = useState(formats[0]?.id ?? '')
  const [coach, setCoach] = useState(defaultCoach ?? coaches[0]?.id ?? '')
  const [day, setDay] = useState(firstDate)
  const [start, setStart] = useState('')
  const [location, setLocation] = useState('video_link')
  const [locationDetail, setLocationDetail] = useState('')
  const [contact, setContact] = useState('none')
  const [notice, setNotice] = useState('')
  const [late, setLate] = useState('')
  const [weekly, setWeekly] = useState(false)
  const [repeatCount, setRepeatCount] = useState('4')
  const slots = state.selection?.coachId === coach && String(state.selection.formatIndex) === format && state.selection.day === day ? state.slots ?? [] : []
  const preview = slots.length && weekly && state.preview?.anchor === start && String(state.preview.count) === repeatCount ? state.preview : null
  const time = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const change = (set: (value: string) => void, value: string) => { set(value); setStart('') }

  return (
    <form onSubmit={(event) => submitForm(event, submit)} className="grid gap-4">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="coaching-format">Session format</Label>
          <select id="coaching-format" name="formatIndex" className={selectClass} value={format} onChange={(e) => change(setFormat, e.target.value)} required>
            {formats.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="coaching-coach">Coach</Label>
          <select id="coaching-coach" name="coachId" className={selectClass} value={coach} onChange={(e) => change(setCoach, e.target.value)} required>
            {coaches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="coaching-day">Date</Label>
          <Input id="coaching-day" name="day" type="date" min={firstDate} max={lastDate} value={day} onChange={(e) => change(setDay, e.target.value)} required />
          <p className="text-muted-foreground text-xs">Times are in {timezone.replaceAll('_', ' ')}.</p>
        </div>
        <div className="flex items-start sm:pt-5">
          <Button type="submit" name="intent" value="availability" variant="outline" formNoValidate disabled={pending}>{pending ? 'Checking…' : 'Find open times'}</Button>
        </div>
      </fieldset>

      {slots.length > 0 && <fieldset disabled={pending} className="grid gap-4 border-t pt-4">
        <div className="grid gap-1.5">
          <Label htmlFor="coaching-time">Open time</Label>
          <select id="coaching-time" name="startsAt" className={selectClass} value={slots.includes(start) ? start : ''} onChange={(e) => setStart(e.target.value)} required>
            <option value="">Choose a time</option>
            {slots.map((slot) => <option key={slot} value={slot}>{time.format(new Date(slot))}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="coaching-location">Meeting type</Label>
            <select id="coaching-location" name="locationType" className={selectClass} value={location} onChange={(e) => { setLocation(e.target.value); setLocationDetail('') }}>
              <option value="video_link">Video link</option><option value="phone">Phone call</option><option value="in_person">In person</option>
              {zoomAvailable && <option value="zoom">Zoom</option>}
            </select>
          </div>
          {location !== 'zoom' && <div className="grid gap-1.5">
            <Label htmlFor="coaching-location-detail">{location === 'video_link' ? 'Meeting link' : location === 'phone' ? 'Call instructions' : 'Meeting location'}</Label>
            <Input id="coaching-location-detail" name="locationDetail" type={location === 'video_link' ? 'url' : 'text'} maxLength={500} value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} required />
          </div>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="coaching-contact">Send invitation and reminder to</Label>
          <select id="coaching-contact" name="contact" className={selectClass} value={contact} onChange={(e) => setContact(e.target.value)}>
            <option value="none">No email recipient</option>
            {contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {contact !== 'none' && <p className="text-muted-foreground text-xs">The host can see the selected contact’s email on the invitation.</p>}
        </div>
        {(noticeHours === null || lateCancellation === 'inherit') && <div className="grid gap-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Cancellation rule</p>
          <p className="text-muted-foreground text-xs">Set the terms this package leaves to the business.</p>
          {noticeHours === null && <div className="grid gap-1.5">
            <Label htmlFor="coaching-notice">Notice required (hours)</Label>
            <Input id="coaching-notice" name="noticeHours" type="number" min={0} max={720} step={1} value={notice} onChange={(e) => setNotice(e.target.value)} required />
          </div>}
          {lateCancellation === 'inherit' && <div className="grid gap-1.5">
            <Label htmlFor="coaching-late">Late family cancellation</Label>
            <select id="coaching-late" name="lateCancellation" className={selectClass} value={late} onChange={(e) => setLate(e.target.value)} required>
              <option value="">Choose an outcome</option><option value="preserve">Release the credits</option><option value="forfeit">Forfeit the credits</option>
            </select>
          </div>}
        </div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary size-4" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> Repeat weekly</label>
        {weekly && <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="coaching-week-count">Number of weekly dates</Label>
            <Input id="coaching-week-count" name="repeatCount" type="number" min={2} max={MAX_WEEKLY_SESSIONS} step={1} value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} required />
          </div>
          <Button type="submit" name="intent" value="preview" variant="outline" formNoValidate disabled={pending || !slots.includes(start)}>Preview weekly dates</Button>
        </div>}
      </fieldset>}
      {state.message && <Alert variant="info"><AlertDescription>{state.message}</AlertDescription></Alert>}
      {slots.length > 0 && !weekly && state.singleNeedsPayment && <p className="text-muted-foreground text-sm">Payment needed. The time will be held and meeting details will go out once payment covers the session.</p>}
      {slots.length > 0 && !weekly && <Button type="submit" name="intent" value="book" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : state.singleNeedsPayment ? 'Reserve session' : 'Book session'}</Button>}
      {preview && <WeeklyDates key={preview.key} preview={preview} pending={pending} timezone={timezone} />}
    </form>
  )
}

export function CoachingMoveForm({ action, initialDate, today, timezone }: {
  action: (state: CoachingMoveState, data: FormData) => Promise<CoachingMoveState>
  initialDate: string; today: string; timezone: string;
}) {
  const [state, submit, pending] = useActionState(action, {})
  const [day, setDay] = useState(initialDate)
  const [start, setStart] = useState('')
  const slots = state.day === day ? state.slots ?? [] : []
  const time = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

  return (
    <form onSubmit={(event) => submitForm(event, submit)} className="grid gap-4">
      <p className="text-muted-foreground text-sm">Choose another time with the same coach in this credit period. The reserved credits stay with this session.</p>
      <fieldset disabled={pending} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-1.5">
          <Label htmlFor="move-coaching-day">New date</Label>
          <Input id="move-coaching-day" name="day" type="date" min={today} value={day} onChange={(event) => { setDay(event.target.value); setStart('') }} required />
        </div>
        <Button type="submit" name="intent" value="availability" variant="outline" formNoValidate disabled={pending}>Find open times</Button>
      </fieldset>
      {slots.length > 0 && <div className="grid gap-1.5">
        <Label htmlFor="move-coaching-time">New time</Label>
        <select id="move-coaching-time" name="startsAt" className={selectClass} value={slots.includes(start) ? start : ''} onChange={(event) => setStart(event.target.value)} required>
          <option value="">Choose a time</option>
          {slots.map((slot) => <option key={slot} value={slot}>{time.format(new Date(slot))}</option>)}
        </select>
      </div>}
      {state.message && <Alert variant="info"><AlertDescription>{state.message}</AlertDescription></Alert>}
      {slots.length > 0 && <Button type="submit" name="intent" value="move" className="justify-self-start" disabled={pending || !slots.includes(start)}>{pending ? 'Moving…' : 'Move session'}</Button>}
    </form>
  )
}

export function CoachingOutcomeForm({ action, paid, canAttend, familyOutcome, credits }: {
  action: (state: CoachingOutcomeState, data: FormData) => Promise<CoachingOutcomeState>
  paid: boolean; canAttend: boolean; familyOutcome: 'released' | 'forfeited'; credits: string;
}) {
  const [state, submit, pending] = useActionState(action, {})
  const [by, setBy] = useState('business')
  const outcome = by === 'guest' ? familyOutcome : 'released'

  return (
    <form action={submit} className="grid gap-4">
      {paid && <div className="grid justify-items-start gap-1.5">
        <Button type="submit" name="intent" value="attend" disabled={!canAttend || pending}>Mark attended</Button>
        <p className="text-muted-foreground text-xs">{canAttend ? `Attendance uses the ${credits} held for this session.` : 'Attendance can be recorded after the session ends.'}</p>
      </div>}
      <details className="rounded-lg border px-3 py-2.5">
        <summary className="cursor-pointer text-sm font-medium">Cancel session</summary>
        <fieldset disabled={pending} className="mt-3 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="coaching-cancel-by">Who cancelled?</Label>
            <select id="coaching-cancel-by" name="by" className={selectClass} value={by} onChange={(e) => setBy(e.target.value)}>
              <option value="business">Coach or business</option><option value="guest">Client or family</option>
            </select>
          </div>
          <input type="hidden" name="expectedOutcome" value={outcome} />
          <p className="text-muted-foreground text-sm">{outcome === 'forfeited' ? `This late cancellation forfeits ${credits}.` : `This cancellation releases ${credits} back to the client’s balance.`}</p>
          <Button type="submit" name="intent" value="cancel" variant="destructive" size="sm" className="justify-self-start">Confirm cancellation</Button>
        </fieldset>
      </details>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
    </form>
  )
}
