'use client'

import { startTransition, useActionState, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { BookingQuestion } from '@/db/schema'
import { QuestionsEditor } from '../../booking-pages/form'
import type { IntakeSettingsState } from './actions'

const textareaClass = 'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

export function IntakeSettingsForm({ save, initial, staff }: {
  save: (state: IntakeSettingsState, data: FormData) => Promise<IntakeSettingsState>
  initial: { enabled: boolean; intro: string; questions: BookingQuestion[]; notify: string[] | null }
  staff: { id: string; name: string; role: string }[]
}) {
  const [state, action, pending] = useActionState(save, {})
  const [enabled, setEnabled] = useState(initial.enabled)
  const [questions, setQuestions] = useState(initial.questions)
  const [everyone, setEveryone] = useState(initial.notify === null)
  const [notify, setNotify] = useState(() => new Set(initial.notify ?? staff.map((s) => s.id)))
  // Submitting by hand keeps React from resetting the checkboxes to their first values afterwards.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(() => action(form))
  }
  const toggle = (id: string, on: boolean) => setNotify((current) => {
    const next = new Set(current)
    if (on) next.add(id)
    else next.delete(id)
    return next
  })
  return (
    <form onSubmit={submit} className="grid gap-6">
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="enabled" checked={enabled} onChange={(ev) => setEnabled(ev.target.checked)} className="accent-primary mt-0.5 size-4" />
        <span><span className="font-medium">Take inquiries online</span><span className="text-muted-foreground block">Families fill in the form without an account. Each one lands in Intake as a new inquiry.</span></span>
      </label>

      <div className="grid gap-1.5">
        <Label htmlFor="intro">Introduction <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <textarea id="intro" name="intro" rows={3} maxLength={1000} defaultValue={initial.intro} className={textareaClass}
          placeholder="Tell us a little about your student and we’ll be in touch within a day." />
        <p className="text-muted-foreground text-xs">Shown at the top of the form.</p>
      </div>

      <div className="grid gap-2">
        <div>
          <p className="text-sm font-medium">Your questions</p>
          <p className="text-muted-foreground text-xs">The form always asks for the family’s contact details, the student’s name and grade, subjects, goals and when they’re free. Add anything else you need here.</p>
        </div>
        <input type="hidden" name="questions" value={JSON.stringify(questions)} />
        <QuestionsEditor questions={questions} onChange={setQuestions} />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Who gets an email about new inquiries</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notifyAll" checked={everyone} onChange={(ev) => setEveryone(ev.target.checked)} className="accent-primary size-4" />
          Every owner and administrator
        </label>
        {!everyone && staff.map((s) => (
          <label key={s.id} className="ml-6 flex items-center gap-2 text-sm">
            <input type="checkbox" name="notify" value={s.id} checked={notify.has(s.id)} onChange={(ev) => toggle(s.id, ev.target.checked)} className="accent-primary size-4" />
            {s.name} <span className="text-muted-foreground text-xs">{s.role}</span>
          </label>
        ))}
        {!everyone && notify.size === 0 && <p className="text-muted-foreground ml-6 text-xs">With nobody ticked, every owner and administrator is emailed.</p>}
      </fieldset>

      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
    </form>
  )
}
