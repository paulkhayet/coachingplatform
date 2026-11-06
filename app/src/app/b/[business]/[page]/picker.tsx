'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TimeGrid, useGuestTimezone, zoneName } from '@/components/booking/time-grid'
import type { BookingQuestion } from '@/db/schema'
import type { GuestBookingState } from './actions'

const textareaClass =
  'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

export function SlotPicker({ starts, durationMinutes, askStudent, questions, priceLabel, action }: { starts: string[]; durationMinutes: number; askStudent: boolean; questions: BookingQuestion[]; priceLabel?: string; action: (prev: GuestBookingState, fd: FormData) => Promise<GuestBookingState> }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<GuestBookingState, FormData>(action, {})
  const tz = useGuestTimezone()
  const [chosen, setChosen] = useState<string | null>(null)

  // If the time was taken meanwhile, reload the open times and go back to picking.
  useEffect(() => {
    if (state.taken) {
      setChosen(null)
      router.refresh()
    }
  }, [state, router])

  if (!tz) return <p className="text-muted-foreground text-sm">Loading times…</p>
  if (!chosen) {
    return (
      <div className="grid gap-4">
        {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
        <TimeGrid starts={starts} tz={tz} onPick={setChosen} />
      </div>
    )
  }

  const start = new Date(chosen)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  const longDay = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' })
  const timeLabel = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  const e = state.errors ?? {}
  const val = (k: string) => { const x = state.values?.[k]; return typeof x === 'string' ? x : '' }
  const picked = (k: string, option: string) => { const x = state.values?.[k]; return Array.isArray(x) ? x.includes(option) : false }
  const err = (k: string) => e[k] && <p className="text-destructive text-xs">{e[k]}</p>

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <button type="button" onClick={() => setChosen(null)} className="text-muted-foreground flex items-center gap-1 justify-self-start text-sm hover:underline"><ArrowLeft className="size-4" /> Change time</button>
      <div>
        <p className="font-medium">{longDay.format(start)}</p>
        <p className="text-muted-foreground text-sm">{timeLabel.format(start)} – {timeLabel.format(end)} · {zoneName(tz)}</p>
      </div>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <input type="hidden" name="start" value={chosen} />
      <input type="hidden" name="timezone" value={tz} />
      {/* Hidden from people; bots that fill every field are rejected. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="grid gap-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" defaultValue={val('name')} aria-invalid={!!e.name} autoFocus />
        {err('name')}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={val('email')} aria-invalid={!!e.email} />
        {e.email ? err('email') : <p className="text-muted-foreground text-xs">Your confirmation and calendar invitation go here.</p>}
      </div>
      {askStudent && (
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="studentName">Student’s name</Label>
            <Input id="studentName" name="studentName" defaultValue={val('studentName')} aria-invalid={!!e.studentName} />
            {err('studentName')}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="studentGrade">Grade <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="studentGrade" name="studentGrade" maxLength={40} defaultValue={val('studentGrade')} aria-invalid={!!e.studentGrade} />
            {err('studentGrade')}
          </div>
        </div>
      )}
      {questions.map((q) => {
        const field = `q_${q.id}`
        const label = <>{q.label} {!q.required && <span className="text-muted-foreground font-normal">(optional)</span>}</>
        if (q.type === 'short' || q.type === 'paragraph') {
          return (
            <div key={q.id} className="grid gap-1.5">
              <Label htmlFor={field}>{label}</Label>
              {q.type === 'short' ? <Input id={field} name={field} maxLength={200} defaultValue={(state.values?.[field] as string[] | undefined)?.[0] ?? ''} aria-invalid={!!e[field]} /> : <textarea id={field} name={field} rows={3} maxLength={2000} defaultValue={(state.values?.[field] as string[] | undefined)?.[0] ?? ''} className={textareaClass} aria-invalid={!!e[field]} />}
              {err(field)}
            </div>
          )
        }
        return (
          <fieldset key={q.id} className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium">{label}</legend>
            {q.options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input type={q.type === 'single' ? 'radio' : 'checkbox'} name={field} value={o} defaultChecked={picked(field, o)} className="accent-primary size-4" />
                {o}
              </label>
            ))}
            {err(field)}
          </fieldset>
        )
      })}
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Anything else you’d like to share? <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={val('notes')} className={textareaClass} />
      </div>
      <Button type="submit" disabled={pending}>{pending ? (priceLabel ? 'Opening payment…' : 'Booking…') : priceLabel ? `Continue to pay ${priceLabel}` : 'Confirm booking'}</Button>
    </form>
  )
}
