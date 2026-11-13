'use client'

import { useActionState, useEffect, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BookingQuestion } from '@/db/schema'
import { RELATIONSHIPS, isSelf } from '@/lib/intake/shared'
import type { InquiryFormState } from './actions'

const fieldClass = 'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'
const optional = <span className="text-muted-foreground font-normal">(optional)</span>

export function InquiryPublicForm({ action, businessName, questions, timezones, defaultTimezone }: {
  action: (state: InquiryFormState, data: FormData) => Promise<InquiryFormState>
  businessName: string
  questions: BookingQuestion[]
  timezones: { value: string; label: string }[]
  defaultTimezone: string
}) {
  const [state, submit, pending] = useActionState(action, {})
  const one = (k: string) => state.values?.[k]?.[0] ?? ''
  const [relationship, setRelationship] = useState('Parent')
  const [timezone, setTimezone] = useState(defaultTimezone)
  // The visitor's own time zone, once the page is in their browser. They can still change it.
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (detected) setTimezone(detected)
    } catch { /* keep the business's time zone */ }
  }, [])
  if (state.ok) {
    return (
      <div className="grid justify-items-center gap-3 py-6 text-center" role="status">
        <CircleCheck className="text-success size-10" aria-hidden="true" />
        <p className="text-lg font-semibold">Thanks{state.firstName ? `, ${state.firstName}` : ''}.</p>
        <p className="text-muted-foreground max-w-sm text-sm">{businessName} has your inquiry and will be in touch. We’ve emailed you a confirmation.</p>
      </div>
    )
  }
  const e = state.errors ?? {}
  const err = (k: string) => e[k] && <p id={`${k}-error`} className="text-destructive text-xs">{e[k]}</p>
  const self = isSelf(relationship)
  const zones = timezones.some((z) => z.value === timezone) ? timezones : [{ value: timezone, label: timezone.replace(/_/g, ' ') }, ...timezones]
  // Remount the uncontrolled fields with what was typed when the server sends the form back.
  const key = state.values ? JSON.stringify(state.values) : 'fresh'
  return (
    <form action={submit} key={key} className="grid gap-6" noValidate>
      {/* Hidden from people; bots that fill every field are ignored. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <fieldset className="grid gap-4" disabled={pending}>
        <legend className="mb-3 font-semibold">About you</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="contactName">Your name</Label>
            <Input id="contactName" name="contactName" autoComplete="name" maxLength={120} defaultValue={one('contactName')} aria-invalid={!!e.contactName} aria-describedby={e.contactName ? 'contactName-error' : undefined} />
            {err('contactName')}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="relationship">You are the student’s</Label>
            <select id="relationship" name="relationship" value={relationship} onChange={(ev) => setRelationship(ev.target.value)} className={`${fieldClass} h-9 w-full min-w-0`}>
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r === 'Self' ? 'I’m the student' : r}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contactEmail">Email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" autoComplete="email" maxLength={254} defaultValue={one('contactEmail')} aria-invalid={!!e.contactEmail} aria-describedby={e.contactEmail ? 'contactEmail-error' : undefined} />
            {err('contactEmail')}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contactPhone">Phone {optional}</Label>
            <Input id="contactPhone" name="contactPhone" type="tel" autoComplete="tel" maxLength={40} defaultValue={one('contactPhone')} aria-invalid={!!e.contactPhone} />
            {err('contactPhone')}
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-4" disabled={pending}>
        <legend className="mb-3 font-semibold">{self ? 'What you’re looking for' : 'About the student'}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {!self && (
            <div className="grid gap-1.5">
              <Label htmlFor="studentName">Student’s name</Label>
              <Input id="studentName" name="studentName" maxLength={100} defaultValue={one('studentName')} aria-invalid={!!e.studentName} aria-describedby={e.studentName ? 'studentName-error' : undefined} />
              {err('studentName')}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="studentGrade">Grade or level {optional}</Label>
            <Input id="studentGrade" name="studentGrade" maxLength={40} placeholder="9th grade" defaultValue={one('studentGrade')} aria-invalid={!!e.studentGrade} />
            {err('studentGrade')}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="subjects">Subjects {optional}</Label>
          <Input id="subjects" name="subjects" maxLength={600} placeholder="Algebra, SAT prep" defaultValue={one('subjects')} aria-invalid={!!e.subjects} />
          {e.subjects ? err('subjects') : <p className="text-muted-foreground text-xs">Separate subjects with commas.</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="goals">What would you like help with? {optional}</Label>
          <textarea id="goals" name="goals" rows={4} maxLength={2000} defaultValue={one('goals')} className={`${fieldClass} py-2`} aria-invalid={!!e.goals} />
          {err('goals')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="availabilityNotes">When are you usually free? {optional}</Label>
            <Input id="availabilityNotes" name="availabilityNotes" maxLength={1000} placeholder="Weekdays after 4 pm" defaultValue={one('availabilityNotes')} aria-invalid={!!e.availabilityNotes} />
            {err('availabilityNotes')}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="timezone">Your time zone</Label>
            <select id="timezone" name="timezone" value={timezone} onChange={(ev) => setTimezone(ev.target.value)} className={`${fieldClass} h-9 w-full min-w-0`}>
              {zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      {questions.length > 0 && (
        <fieldset className="grid gap-4" disabled={pending}>
          <legend className="mb-3 font-semibold">A few more questions</legend>
          {questions.map((q) => {
            const field = `q_${q.id}`
            const label = <>{q.label} {!q.required && optional}</>
            if (q.type === 'short' || q.type === 'paragraph') {
              return (
                <div key={q.id} className="grid gap-1.5">
                  <Label htmlFor={field}>{label}</Label>
                  {q.type === 'short'
                    ? <Input id={field} name={field} maxLength={200} defaultValue={one(field)} aria-invalid={!!e[field]} />
                    : <textarea id={field} name={field} rows={3} maxLength={2000} defaultValue={one(field)} className={`${fieldClass} py-2`} aria-invalid={!!e[field]} />}
                  {err(field)}
                </div>
              )
            }
            return (
              <fieldset key={q.id} className="grid gap-1.5">
                <legend className="mb-1 text-sm font-medium">{label}</legend>
                {q.options.map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm">
                    <input type={q.type === 'single' ? 'radio' : 'checkbox'} name={field} value={o} defaultChecked={state.values?.[field]?.includes(o) ?? false} className="accent-primary size-4" />
                    {o}
                  </label>
                ))}
                {err(field)}
              </fieldset>
            )
          })}
        </fieldset>
      )}

      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <div className="grid gap-2">
        <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Sending…' : 'Send inquiry'}</Button>
        <p className="text-muted-foreground text-xs">Your answers go to {businessName}. You don’t need an account.</p>
      </div>
    </form>
  )
}
