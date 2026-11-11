'use client'

import { useActionState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendContactRequest, type ContactState } from './actions'
import { TEAM_SIZES } from './sizes'

const fieldClass = 'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

export function ContactForm({ plan }: { plan: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactRequest, {})
  if (state.ok) {
    return (
      <div className="grid justify-items-center gap-3 py-4 text-center">
        <CircleCheck className="text-success size-10" />
        <p className="text-lg font-semibold">Thanks{state.values?.name ? `, ${state.values.name.split(' ')[0]}` : ''}.</p>
        <p className="text-muted-foreground text-sm">We got your message and will reply{state.values?.email ? ` to ${state.values.email}` : ''}.</p>
      </div>
    )
  }
  const e = state.errors ?? {}
  const v = state.values ?? {}
  const err = (k: string) => e[k] && <p className="text-destructive text-xs">{e[k]}</p>
  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <input type="hidden" name="plan" value={plan} />
      {/* Hidden from people; bots that fill every field are ignored. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="grid gap-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" defaultValue={v.name} aria-invalid={!!e.name} />
        {err('name')}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} aria-invalid={!!e.email} />
        {err('email')}
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="organization">Organization</Label>
          <Input id="organization" name="organization" autoComplete="organization" defaultValue={v.organization} aria-invalid={!!e.organization} />
          {err('organization')}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="teamSize">Team size</Label>
          <select id="teamSize" name="teamSize" defaultValue={v.teamSize ?? ''} className={`${fieldClass} h-9 w-full min-w-0`} aria-invalid={!!e.teamSize}>
            <option value="" disabled>Choose…</option>
            {TEAM_SIZES.map((s) => <option key={s} value={s}>{s} people</option>)}
          </select>
          {err('teamSize')}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="message">What would you like to know? <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <textarea id="message" name="message" rows={4} maxLength={4000} defaultValue={v.message} className={`${fieldClass} py-2`} />
        {err('message')}
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send'}</Button>
    </form>
  )
}
