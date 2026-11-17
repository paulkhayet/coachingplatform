'use client'

import { useActionState, useId, useState } from 'react'
import { CopyButton } from '@/components/copy-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { PaymentLinkState } from './card-actions'

type Action = (state: PaymentLinkState, data: FormData) => Promise<PaymentLinkState>
export type CardContact = { value: string; label: string; guardian: boolean; hasPortal: boolean }

const selectClass = 'bg-background border-input focus-visible:ring-ring dark:bg-input/30 h-9 w-full min-w-0 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'

/** Send a family a link to pay for this package by card (D-076). */
export function PaymentLinkForm({ action, contacts, instalments }: { action: Action; contacts: CardContact[]; instalments: string | null }) {
  const [state, submit, pending] = useActionState(action, {})
  const uid = useId()
  const [to, setTo] = useState(contacts.find((c) => c.guardian)?.value ?? contacts[0]?.value ?? '')
  const [invite, setInvite] = useState(true)
  const [allowPlan, setAllowPlan] = useState(true)
  const chosen = contacts.find((c) => c.value === to)
  if (state.link) {
    return (
      <div className="grid gap-2">
        <Alert variant="success"><AlertDescription>
          {state.link.sentTo ? (state.link.emailed ? `Sent to ${state.link.sentTo}.` : `Created. Email isn’t set up here, so send ${state.link.sentTo} this link yourself.`) : 'Created. Share this link with the family.'}
        </AlertDescription></Alert>
        <div className="flex flex-wrap items-center gap-2">
          <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs">{state.link.url}</code>
          <CopyButton text={state.link.url} />
        </div>
        <p className="text-muted-foreground text-xs">For your records only: the link isn’t shown again. You can always send a new one.</p>
      </div>
    )
  }
  // Submitting by hand keeps the checkboxes as chosen while the action runs.
  return (
    <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); submit(data) }} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${uid}-to`}>Email the link to</Label>
        <select id={`${uid}-to`} name="contact" value={to} onChange={(ev) => setTo(ev.target.value)} className={selectClass}>
          {contacts.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          <option value="">Don’t email it: I’ll share the link</option>
        </select>
      </div>
      {instalments && (
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="instalments" checked={allowPlan} onChange={(ev) => setAllowPlan(ev.target.checked)} className="accent-primary mt-0.5 size-4" />
          <span>Let them pay in instalments<span className="text-muted-foreground block text-xs">{instalments}, charged automatically.</span></span>
        </label>
      )}
      {chosen?.guardian && !chosen.hasPortal && (
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="invite" checked={invite} onChange={(ev) => setInvite(ev.target.checked)} className="accent-primary mt-0.5 size-4" />
          <span>Invite them to the family portal once they’ve paid<span className="text-muted-foreground block text-xs">So they can see sessions, credits and shared files.</span></span>
        </label>
      )}
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" size="sm" className="justify-self-start" disabled={pending}>{pending ? 'Sending…' : to ? 'Send payment link' : 'Create payment link'}</Button>
    </form>
  )
}

export function CancelLinkButton({ action, plan }: { action: Action; plan: boolean }) {
  const [state, submit, pending] = useActionState(action, {})
  const [sure, setSure] = useState(false)
  if (!sure) return <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSure(true)}>{plan ? 'Stop plan' : 'Turn off'}</Button>
  return (
    <form action={submit} className="flex flex-wrap items-center gap-2">
      <span className="text-xs">{plan ? 'Stop future instalments? Payments already made stay.' : 'Turn this link off?'}</span>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>{pending ? 'Stopping…' : 'Yes'}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setSure(false)}>No</Button>
      {state.message && <span role="alert" className="text-destructive text-xs">{state.message}</span>}
    </form>
  )
}
