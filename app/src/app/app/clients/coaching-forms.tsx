'use client'

import { useActionState, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CoachingBookingState, CoachingOutcomeState } from './coaching-actions'

type Choice = { id: string; name: string }
const selectClass = 'bg-background border-input focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60'

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
  const slots = state.selection?.coachId === coach && String(state.selection.formatIndex) === format && state.selection.day === day ? state.slots ?? [] : []
  const time = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const change = (set: (value: string) => void, value: string) => { set(value); setStart('') }

  return (
    <form action={submit} className="grid gap-4">
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
      </fieldset>}
      {state.message && <Alert variant="info"><AlertDescription>{state.message}</AlertDescription></Alert>}
      {slots.length > 0 && <Button type="submit" name="intent" value="book" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Book session'}</Button>}
    </form>
  )
}

export function CoachingOutcomeForm({ action, canAttend, familyOutcome, credits }: {
  action: (state: CoachingOutcomeState, data: FormData) => Promise<CoachingOutcomeState>
  canAttend: boolean; familyOutcome: 'released' | 'forfeited'; credits: string;
}) {
  const [state, submit, pending] = useActionState(action, {})
  const [by, setBy] = useState('business')
  const outcome = by === 'guest' ? familyOutcome : 'released'

  return (
    <form action={submit} className="grid gap-4">
      <div className="grid justify-items-start gap-1.5">
        <Button type="submit" name="intent" value="attend" disabled={!canAttend || pending}>Mark attended</Button>
        <p className="text-muted-foreground text-xs">{canAttend ? `Attendance uses the ${credits} held for this session.` : 'Attendance can be recorded after the session ends.'}</p>
      </div>
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
