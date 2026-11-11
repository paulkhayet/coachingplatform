'use client'

import { useActionState, useId, useState, type ComponentProps } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ClientActionState } from './actions'
import { paymentMethodLabels, type ClientRow, type GuardianRow } from './data'

type FormAction = (state: ClientActionState, data: FormData) => Promise<ClientActionState>
type Choice = { id: string; name: string }
const selectClass = 'bg-background border-input focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60'

function InputField({ label, error, hint, ...props }: ComponentProps<typeof Input> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${id}-help` : undefined} />
      {(error || hint) && <p id={`${id}-help`} className={error ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>{error || hint}</p>}
    </div>
  )
}

function SelectField({ label, error, children, ...props }: ComponentProps<'select'> & { label: string; error?: string }) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select {...props} id={id} className={selectClass} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>{children}</select>
      {error && <p id={`${id}-error`} className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

function FormMessage({ state }: { state: ClientActionState }) {
  return state.message ? <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert> : null
}

export function ClientForm({ action, client, coaches }: { action: FormAction; client?: ClientRow; coaches: Choice[] }) {
  const [state, submit, pending] = useActionState(action, {})
  const [name, setName] = useState(client?.name ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [coach, setCoach] = useState(client?.coach_membership_id ?? '')
  const unavailable = coach && !coaches.some((item) => item.id === coach)

  return (
    <form action={submit} className="grid gap-4">
      <fieldset disabled={pending} className="grid gap-4">
        <InputField name="name" label="Client name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} error={state.errors?.name} required />
        <InputField name="email" label="Client email (optional)" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} error={state.errors?.email} />
        <SelectField name="coachId" label="Assigned coach" value={coach} onChange={(event) => setCoach(event.target.value)} error={state.errors?.coachId}>
          <option value="">Unassigned</option>
          {unavailable && <option value={coach}>Unavailable coach</option>}
          {coaches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </SelectField>
      </fieldset>
      <FormMessage state={state} />
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : client ? 'Save client' : 'Create client'}</Button>
    </form>
  )
}

export function GuardianForm({ action, guardian }: { action: FormAction; guardian?: GuardianRow }) {
  const [state, submit, pending] = useActionState(action, {})
  const [name, setName] = useState(guardian?.name ?? '')
  const [relationship, setRelationship] = useState(guardian?.relationship ?? '')
  const [email, setEmail] = useState(guardian?.email ?? '')
  const [phone, setPhone] = useState(guardian?.phone ?? '')

  return (
    <form action={submit} className="grid gap-4">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <InputField name="name" label="Guardian name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} error={state.errors?.name} required />
        <InputField name="relationship" label="Relationship (optional)" value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Parent or guardian" maxLength={80} error={state.errors?.relationship} />
        <InputField name="email" label="Guardian email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} error={state.errors?.email} />
        <InputField name="phone" label="Guardian phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} error={state.errors?.phone} />
      </fieldset>
      <FormMessage state={state} />
      <Button type="submit" size="sm" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save contact'}</Button>
    </form>
  )
}

export function AssignPackageForm({ action, packages, today }: { action: FormAction; packages: (Choice & { version: string })[]; today: string }) {
  const [state, submit, pending] = useActionState(action, {})
  const [packageId, setPackageId] = useState('')
  const [startsOn, setStartsOn] = useState(today)

  return (
    <form action={submit} className="grid gap-4">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <input type="hidden" name="packageVersion" value={packages.find((pkg) => pkg.id === packageId)?.version ?? ''} />
        <SelectField name="packageId" label="Coaching package" value={packageId} onChange={(event) => setPackageId(event.target.value)} error={state.errors?.packageId} required>
          <option value="">Choose a package</option>
          {packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
        </SelectField>
        <InputField name="startsOn" label="Start date" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} error={state.errors?.startsOn} required />
      </fieldset>
      <FormMessage state={state} />
      <Button type="submit" size="sm" className="justify-self-start" disabled={pending}>{pending ? 'Assigning…' : 'Assign package'}</Button>
    </form>
  )
}

export function OfflinePaymentForm({ action, remainingCents, monthly, today }: { action: FormAction; remainingCents: number; monthly: boolean; today: string }) {
  const [state, submit, pending] = useActionState(action, {})
  const remaining = (remainingCents / 100).toFixed(2)
  const [amount, setAmount] = useState(monthly ? remaining : '')
  const [method, setMethod] = useState('')
  const [receivedOn, setReceivedOn] = useState(today)
  const [reference, setReference] = useState('')

  return (
    <form action={submit} className="grid gap-4">
      <p className="text-muted-foreground text-sm">Record a payment the business has already received.{monthly ? ' This monthly period funds credits when paid in full.' : ''}</p>
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <InputField name="amount" label="Amount (USD)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={remaining} hint={`Remaining balance $${remaining}`} error={state.errors?.amountCents} required />
        <SelectField name="method" label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)} error={state.errors?.method} required>
          <option value="">Choose a method</option>
          {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <InputField name="receivedOn" label="Date received" type="date" max={today} value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} error={state.errors?.receivedOn} required />
        <InputField name="reference" label="Receipt reference (optional)" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={200} error={state.errors?.reference} />
      </fieldset>
      <FormMessage state={state} />
      <Button type="submit" size="sm" className="justify-self-start" disabled={pending}>{pending ? 'Recording…' : 'Record payment'}</Button>
    </form>
  )
}
