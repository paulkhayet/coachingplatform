'use client'

import { startTransition, useActionState, useId, useState, useTransition, type ComponentProps } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FIRST_CALL_MINUTES, FIRST_CALL_OUTCOMES, LOST_REASONS, OPEN_STAGES, RELATIONSHIPS, STAGE_LABELS, isSelf, type OpenStage } from '@/lib/intake/shared'
import { cn } from '@/lib/utils'
import type { FirstCallState, IntakeState } from './actions'

type Action = (state: IntakeState, data: FormData) => Promise<IntakeState>
export type Choice = { id: string; name: string }

export const selectClass = 'bg-background border-input focus-visible:ring-ring dark:bg-input/30 h-9 w-full min-w-0 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60'
export const textareaClass = 'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

/**
 * Submits a form by hand. Letting React run the action would reset the form afterwards, which snaps
 * menus and checkboxes back to their first values while the component still remembers what was chosen:
 * the screen and what gets sent next would disagree. The pressed button's name and value are kept.
 */
export function manualSubmit(action: (data: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter)
    startTransition(() => action(data))
  }
}

function Field({ label, error, hint, optional, ...props }: ComponentProps<typeof Input> & { label: string; error?: string; hint?: string; optional?: boolean }) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}{optional && <span className="text-muted-foreground font-normal"> (optional)</span>}</Label>
      <Input {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${id}-help` : undefined} />
      {(error || hint) && <p id={`${id}-help`} className={error ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>{error || hint}</p>}
    </div>
  )
}

function Result({ state }: { state: IntakeState }) {
  if (state.message) return <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>
  return state.done ? <p role="status" className="text-success text-xs">{state.done}</p> : null
}

export interface InquiryValues {
  contactName: string; contactEmail: string; contactPhone: string; relationship: string; studentName: string; studentGrade: string
  subjects: string; goals: string; availabilityNotes: string; timezone: string
}

/** Add an inquiry by hand, or correct one's details. */
export function InquiryForm({ action, defaults, submitLabel, timezones }: { action: Action; defaults: InquiryValues; submitLabel: string; timezones: readonly string[] }) {
  const [state, submit, pending] = useActionState(action, {})
  const v = (k: keyof InquiryValues) => state.values?.[k] ?? defaults[k]
  const e = state.errors ?? {}
  const [relationship, setRelationship] = useState(v('relationship') || 'Parent')
  const known = (RELATIONSHIPS as readonly string[]).includes(relationship)
  const zones = timezones.includes(v('timezone')) || !v('timezone') ? timezones : [v('timezone'), ...timezones]
  const formKey = JSON.stringify(state.values ?? defaults)
  return (
    <form onSubmit={manualSubmit(submit)} key={formKey} className="grid gap-5">
      <fieldset disabled={pending} className="grid gap-4">
        <legend className="mb-3 text-sm font-medium">Family contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="contactName" label="Contact name" defaultValue={v('contactName')} maxLength={120} error={e.contactName} required />
          <div className="grid gap-1.5">
            <Label htmlFor="relationship">Relationship to the student</Label>
            <select id="relationship" name="relationship" value={relationship} onChange={(ev) => setRelationship(ev.target.value)} className={selectClass}>
              {!known && <option value={relationship}>{relationship}</option>}
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r === 'Self' ? 'Self (the student)' : r}</option>)}
            </select>
          </div>
          <Field name="contactEmail" label="Email" type="email" defaultValue={v('contactEmail')} maxLength={254} error={e.contactEmail} required />
          <Field name="contactPhone" label="Phone" type="tel" optional defaultValue={v('contactPhone')} maxLength={40} error={e.contactPhone} />
        </div>
      </fieldset>
      <fieldset disabled={pending} className="grid gap-4">
        <legend className="mb-3 text-sm font-medium">Student</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {!isSelf(relationship) && <Field name="studentName" label="Student name" defaultValue={v('studentName')} maxLength={100} error={e.studentName} required />}
          <Field name="studentGrade" label="Grade or level" optional defaultValue={v('studentGrade')} maxLength={40} error={e.studentGrade} />
        </div>
        <Field name="subjects" label="Subjects" optional defaultValue={v('subjects')} maxLength={600} placeholder="SAT Math, essay writing" hint="Separate subjects with commas. They’re matched against each coach’s subjects." error={e.subjects} />
        <div className="grid gap-1.5">
          <Label htmlFor="goals">Goals <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <textarea id="goals" name="goals" rows={3} maxLength={2000} defaultValue={v('goals')} className={textareaClass} aria-invalid={Boolean(e.goals)} />
          {e.goals && <p className="text-destructive text-xs">{e.goals}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="availabilityNotes" label="When they’re free" optional defaultValue={v('availabilityNotes')} maxLength={1000} placeholder="Weekdays after 4" error={e.availabilityNotes} />
          <div className="grid gap-1.5">
            <Label htmlFor="timezone">Their time zone</Label>
            <select id="timezone" name="timezone" defaultValue={v('timezone')} className={selectClass}>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
      </fieldset>
      <Result state={state} />
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
    </form>
  )
}

/** The stage menu on a board card or the inquiry page: choose a stage and it moves. Works by keyboard and touch. */
export function StageSelect({ action, stage, label }: { action: Action; stage: OpenStage; label: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  return (
    <div className="grid gap-1">
      <select aria-label={label} value={stage} disabled={pending} className={cn(selectClass, 'h-8 text-xs')}
        onChange={(ev) => {
          const data = new FormData()
          data.set('stage', ev.target.value)
          start(async () => setError((await action({}, data)).message))
        }}>
        {OPEN_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
      </select>
      {error && <p role="alert" className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

/** One button that moves an inquiry: reopen it, send it to Offer, or back to Matching for a new coach. */
export function StageButton({ action, stage, rematch, children, variant = 'outline' }: { action: Action; stage: OpenStage; rematch?: boolean; children: React.ReactNode; variant?: ComponentProps<typeof Button>['variant'] }) {
  const [state, submit, pending] = useActionState(action, {})
  return (
    <form action={submit} className="grid gap-1">
      <input type="hidden" name="stage" value={stage} />
      {rematch && <input type="hidden" name="rematch" value="yes" />}
      <Button type="submit" variant={variant} size="sm" disabled={pending} className="justify-self-start">{pending ? 'Moving…' : children}</Button>
      {state.message && <p role="alert" className="text-destructive text-xs">{state.message}</p>}
    </form>
  )
}

export function LostForm({ action }: { action: Action }) {
  const [state, submit, pending] = useActionState(action, {})
  const [reason, setReason] = useState('')
  return (
    <form onSubmit={manualSubmit(submit)} className="grid gap-3">
      <input type="hidden" name="stage" value="lost" />
      <div className="grid gap-1.5">
        <Label htmlFor="lostReason">Why didn’t they enrol?</Label>
        <select id="lostReason" name="lostReason" value={reason} onChange={(ev) => setReason(ev.target.value)} className={selectClass} required>
          <option value="" disabled>Choose a reason</option>
          {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {reason === 'Other' && <Field name="lostReasonOther" label="What happened?" maxLength={300} required />}
      <Result state={state} />
      <Button type="submit" variant="outline" size="sm" className="justify-self-start" disabled={pending || !reason}>{pending ? 'Closing…' : 'Mark as lost'}</Button>
    </form>
  )
}

export function AssignForm({ action, owners, coaches, ownerId, coachId }: { action: Action; owners: Choice[]; coaches: Choice[]; ownerId: string | null; coachId: string | null }) {
  const [state, submit, pending] = useActionState(action, {})
  const [owner, setOwner] = useState(ownerId ?? '')
  const [coach, setCoach] = useState(coachId ?? '')
  // A saved value for someone who has since left still shows, so saving doesn't silently clear it.
  const gone = (id: string, list: Choice[]) => id && !list.some((c) => c.id === id)
  return (
    <form onSubmit={manualSubmit(submit)} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ownerId">Handled by</Label>
        <select id="ownerId" name="ownerId" value={owner} onChange={(ev) => setOwner(ev.target.value)} className={selectClass}>
          <option value="">Nobody yet</option>
          {gone(owner, owners) && <option value={owner}>Former team member</option>}
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="coachId">Proposed coach</Label>
        <select id="coachId" name="coachId" value={coach} onChange={(ev) => setCoach(ev.target.value)} className={selectClass}>
          <option value="">No coach yet</option>
          {gone(coach, coaches) && <option value={coach}>Former coach</option>}
          {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <Result state={state} />
      <Button type="submit" variant="outline" size="sm" className="justify-self-start" disabled={pending || (owner === (ownerId ?? '') && coach === (coachId ?? ''))}>{pending ? 'Saving…' : 'Save'}</Button>
    </form>
  )
}

/** Proposes one of the suggested coaches (or assigns from the Assignments page). */
export function ProposeButton({ action, coachId, label = 'Propose' }: { action: Action; coachId: string; label?: string }) {
  const [state, submit, pending] = useActionState(action, {})
  return (
    <form action={submit} className="grid justify-items-end gap-1">
      <input type="hidden" name="coachId" value={coachId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? 'Saving…' : label}</Button>
      {state.message && <p role="alert" className="text-destructive max-w-48 text-right text-xs">{state.message}</p>}
    </form>
  )
}

export function NextActionForm({ action, nextAction, nextActionDue }: { action: Action; nextAction: string | null; nextActionDue: string | null }) {
  const [state, submit, pending] = useActionState(action, {})
  const [text, setText] = useState(nextAction ?? '')
  const [due, setDue] = useState(nextActionDue ?? '')
  return (
    <form onSubmit={manualSubmit(submit)} className="grid gap-3">
      <Field name="nextAction" label="Next step" value={text} onChange={(ev) => setText(ev.target.value)} maxLength={200} placeholder="Send pricing to Dana" error={state.errors?.nextAction} />
      <Field name="nextActionDue" label="Due" type="date" value={due} onChange={(ev) => setDue(ev.target.value)} error={state.errors?.nextActionDue} />
      <Result state={state} />
      <Button type="submit" variant="outline" size="sm" className="justify-self-start" disabled={pending || (text === (nextAction ?? '') && due === (nextActionDue ?? ''))}>{pending ? 'Saving…' : 'Save'}</Button>
    </form>
  )
}

export function NoteForm({ action }: { action: Action }) {
  const [state, submit, pending] = useActionState(action, {})
  return (
    <form action={submit} className="grid gap-2">
      <Label htmlFor="note" className="sr-only">Add a note</Label>
      <textarea id="note" name="note" rows={2} maxLength={2000} placeholder="Add a note for the team" className={textareaClass} aria-invalid={Boolean(state.errors?.note)} required />
      {state.errors?.note && <p className="text-destructive text-xs">{state.errors.note}</p>}
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" size="sm" variant="outline" className="justify-self-start" disabled={pending}>{pending ? 'Adding…' : 'Add note'}</Button>
    </form>
  )
}

export function OutcomeForm({ action }: { action: Action }) {
  const [state, submit, pending] = useActionState(action, {})
  return (
    <form action={submit} className="grid gap-3">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">How did the call go?</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {FIRST_CALL_OUTCOMES.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm"><input type="radio" name="outcome" value={o.value} className="accent-primary size-4" required /> {o.label}</label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="outcome-note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <textarea id="outcome-note" name="note" rows={2} maxLength={2000} className={textareaClass} />
      </div>
      <Result state={state} />
      <Button type="submit" size="sm" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Record outcome'}</Button>
    </form>
  )
}

const MEETING_TYPES = [
  { value: 'video_link', label: 'Video link', detail: 'Meeting link', placeholder: 'https://meet.google.com/…' },
  { value: 'phone', label: 'Phone call', detail: 'Who calls whom', placeholder: 'We’ll call the number you gave us' },
  { value: 'in_person', label: 'In person', detail: 'Address', placeholder: '12 Main St, Suite 4' },
  { value: 'zoom', label: 'Zoom', detail: '', placeholder: '' },
] as const

/** Pick a day, see the proposed coach's open times, then book the first call. */
export function FirstCallForm({ action, coachName, timezone, today, zoomAvailable }: { action: (state: FirstCallState, data: FormData) => Promise<FirstCallState>; coachName: string; timezone: string; today: string; zoomAvailable: boolean }) {
  const [state, submit, pending] = useActionState(action, {})
  const [day, setDay] = useState(today)
  const [minutes, setMinutes] = useState(30)
  const [type, setType] = useState<(typeof MEETING_TYPES)[number]['value']>('video_link')
  const meeting = MEETING_TYPES.find((m) => m.value === type)!
  const current = state.day === day && state.durationMinutes === minutes
  const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  return (
    <form onSubmit={manualSubmit(submit)} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <Field name="day" label="Date" type="date" min={today} value={day} onChange={(ev) => setDay(ev.target.value)} required />
        <div className="grid gap-1.5">
          <Label htmlFor="durationMinutes">Length</Label>
          <select id="durationMinutes" name="durationMinutes" value={minutes} onChange={(ev) => setMinutes(Number(ev.target.value))} className={selectClass}>
            {FIRST_CALL_MINUTES.map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </div>
        <Button type="submit" name="intent" value="availability" variant="outline" disabled={pending}>{pending ? 'Checking…' : 'Find open times'}</Button>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">{coachName}’s open times, shown in {timezone.replace(/_/g, ' ')}.</p>
      {current && state.slots && state.slots.length > 0 && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="startsAt">Open time</Label>
            <select id="startsAt" name="startsAt" defaultValue="" className={selectClass} required>
              <option value="" disabled>Choose a time</option>
              {state.slots.map((s) => <option key={s} value={s}>{timeFmt.format(new Date(s))}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="locationType">How you’ll meet</Label>
              <select id="locationType" name="locationType" value={type} onChange={(ev) => setType(ev.target.value as typeof type)} className={selectClass}>
                {MEETING_TYPES.filter((m) => m.value !== 'zoom' || zoomAvailable).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {type === 'zoom' ? <p className="text-muted-foreground self-end text-xs sm:pb-2">A Zoom meeting is created on {coachName}’s account.</p> : (
              <Field name="locationDetail" label={meeting.detail} type={type === 'video_link' ? 'url' : 'text'} maxLength={500} placeholder={meeting.placeholder} required />
            )}
          </div>
          <Button type="submit" name="intent" value="book" className="justify-self-start" disabled={pending}>{pending ? 'Booking…' : 'Book first call'}</Button>
          <p className="text-muted-foreground -mt-2 text-xs">The family gets a confirmation email, and it goes on {coachName}’s calendar.</p>
        </>
      )}
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
    </form>
  )
}

export function ConvertForm({ action, studentName, guardianName }: { action: Action; studentName: string; guardianName: string | null }) {
  const [state, submit, pending] = useActionState(action, {})
  return (
    <form action={submit} className="grid gap-2">
      <p className="text-muted-foreground text-sm">Creates {studentName} as a client{guardianName ? ` with ${guardianName} as their guardian contact` : ''}, and keeps this history with them.</p>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Creating client…' : 'Convert to client'}</Button>
    </form>
  )
}
