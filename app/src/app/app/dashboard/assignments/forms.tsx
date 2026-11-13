'use client'

import { useActionState, useId, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { manualSubmit, selectClass, type Choice } from '../intake/forms'
import type { AssignmentState } from './actions'

type Action = (state: AssignmentState, data: FormData) => Promise<AssignmentState>

/** One button: give this client the suggested coach. */
export function AssignCoachButton({ action, coachId, label = 'Assign' }: { action: Action; coachId: string; label?: string }) {
  const [state, submit, pending] = useActionState(action, {})
  return (
    <form action={submit} className="grid justify-items-end gap-1">
      <input type="hidden" name="coachId" value={coachId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? 'Saving…' : label}</Button>
      {state.message && <p role="alert" className="text-destructive max-w-48 text-right text-xs">{state.message}</p>}
    </form>
  )
}

/** Move one client to another coach. */
export function ReassignSelect({ action, coachId, coaches, clientName }: { action: Action; coachId: string | null; coaches: Choice[]; clientName: string }) {
  const [state, submit, pending] = useActionState(action, {})
  const [value, setValue] = useState(coachId ?? '')
  return (
    <form onSubmit={manualSubmit(submit)} className="grid gap-1">
      <div className="flex items-center gap-2">
        <select name="coachId" aria-label={`Coach for ${clientName}`} value={value} onChange={(ev) => setValue(ev.target.value)} className={`${selectClass} h-8 w-44 text-xs`}>
          <option value="">Unassigned</option>
          {coachId && !coaches.some((c) => c.id === coachId) && <option value={coachId}>Former coach</option>}
          {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button type="submit" variant="outline" size="sm" disabled={pending || value === (coachId ?? '')}>{pending ? 'Moving…' : 'Move'}</Button>
      </div>
      {state.message && <p role="alert" className="text-destructive text-xs">{state.message}</p>}
    </form>
  )
}

export function MoveAllForm({ action, fromName, count, coaches }: { action: Action; fromName: string; count: number; coaches: Choice[] }) {
  const [state, submit, pending] = useActionState(action, {})
  const [to, setTo] = useState('')
  const [sure, setSure] = useState(false)
  return (
    <form onSubmit={manualSubmit(submit)} className="grid gap-3">
      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor="toCoachId">Move all {count} of {fromName}’s clients to</Label>
        <select id="toCoachId" name="toCoachId" value={to} onChange={(ev) => setTo(ev.target.value)} className={selectClass}>
          <option value="">Unassigned (choose coaches later)</option>
          {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" checked={sure} onChange={(ev) => setSure(ev.target.checked)} className="accent-primary size-4" />
        Yes, move them all
      </label>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      {state.done && <p role="status" className="text-success text-xs">{state.done}</p>}
      <Button type="submit" variant="outline" size="sm" className="justify-self-start" disabled={pending || !sure}>{pending ? 'Moving…' : 'Move clients'}</Button>
    </form>
  )
}

/** Subjects and client limit for one coach. Coaches editing themselves only get the subjects. */
export function CoachProfileForm({ action, specialties, maxClients, withLimit }: { action: Action; specialties: string[]; maxClients: number | null; withLimit: boolean }) {
  const [state, submit, pending] = useActionState(action, {})
  const [subjects, setSubjects] = useState(specialties.join(', '))
  const [limit, setLimit] = useState(maxClients === null ? '' : String(maxClients))
  // One form per coach on the Assignments page: keep ids unique.
  const uid = useId()
  return (
    <form onSubmit={manualSubmit(submit)} className="grid gap-3">
      <div className={withLimit ? 'grid gap-3 sm:grid-cols-[1fr_9rem]' : 'grid gap-3'}>
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-specialties`}>Subjects</Label>
          <Input id={`${uid}-specialties`} name="specialties" value={subjects} onChange={(ev) => setSubjects(ev.target.value)} maxLength={1500} placeholder="SAT Math, Algebra, ADHD coaching" aria-invalid={Boolean(state.errors?.specialties)} />
          {state.errors?.specialties ? <p className="text-destructive text-xs">{state.errors.specialties}</p> : <p className="text-muted-foreground text-xs">Separate with commas. Matched against what families ask for.</p>}
        </div>
        {withLimit && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-maxClients`}>Most clients</Label>
            <Input id={`${uid}-maxClients`} name="maxClients" inputMode="numeric" value={limit} onChange={(ev) => setLimit(ev.target.value)} placeholder="No limit" aria-invalid={Boolean(state.errors?.maxClients)} />
            {state.errors?.maxClients && <p className="text-destructive text-xs">{state.errors.maxClients}</p>}
          </div>
        )}
      </div>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      {state.done && <p role="status" className="text-success text-xs">{state.done}</p>}
      <Button type="submit" variant="outline" size="sm" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
    </form>
  )
}
