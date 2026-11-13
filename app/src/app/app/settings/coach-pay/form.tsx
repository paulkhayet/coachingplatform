'use client'

import { startTransition, useActionState, useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PayMethod } from '@/db/schema'
import { PAY_METHOD_LABELS } from '@/lib/insights/finance'
import type { CoachPayState } from './actions'

type Action = (state: CoachPayState, data: FormData) => Promise<CoachPayState>
const selectClass = 'bg-background border-input focus-visible:ring-ring dark:bg-input/30 h-9 w-full min-w-0 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'

const AMOUNT_LABEL: Record<Exclude<PayMethod, 'percent'>, string> = { hourly: 'Per hour ($)', per_session: 'Per session ($)', salary: 'Per month ($)' }
const METHOD_HELP: Record<PayMethod, string> = {
  hourly: 'Paid for the length of each delivered session.',
  per_session: 'A flat amount for each delivered session, with different amounts for some session formats if you like.',
  percent: 'A share of what each delivered session is worth: the call’s price, or the package price divided across its credits.',
  salary: 'A fixed amount each month, whatever the number of sessions. Part months count by the day.',
}

export interface PayDefaults {
  method: PayMethod
  amount: string
  percent: string
  overrides: { formatName: string; amount: string }[]
  payForfeited: boolean
}

export function CoachPayForm({ save, defaults, today, formatNames }: { save: Action; defaults: PayDefaults; today: string; formatNames: string[] }) {
  const [state, action, pending] = useActionState(save, {})
  // Several coaches' forms share the page, so every field id is unique to this one.
  const uid = useId()
  const [method, setMethod] = useState<PayMethod>(defaults.method)
  const [overrides, setOverrides] = useState(defaults.overrides)
  const [forfeited, setForfeited] = useState(defaults.payForfeited)
  // Submitting by hand keeps React from resetting the checkbox and selects after the save.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(() => action(form))
  }
  const e = state.errors ?? {}
  const unused = formatNames.filter((n) => !overrides.some((o) => o.formatName.toLowerCase() === n.toLowerCase()))
  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-method`}>Paid</Label>
          <select id={`${uid}-method`} name="method" value={method} onChange={(ev) => setMethod(ev.target.value as PayMethod)} className={selectClass}>
            {(Object.keys(PAY_METHOD_LABELS) as PayMethod[]).map((m) => <option key={m} value={m}>{PAY_METHOD_LABELS[m]}</option>)}
          </select>
        </div>
        {method === 'percent' ? (
          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-percent`}>Share (%)</Label>
            <Input id={`${uid}-percent`} name="percent" inputMode="decimal" defaultValue={defaults.percent} placeholder="40" aria-invalid={Boolean(e.percent)} />
            {e.percent && <p className="text-destructive text-xs">{e.percent}</p>}
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-amount`}>{AMOUNT_LABEL[method]}</Label>
            <Input id={`${uid}-amount`} name="amount" inputMode="decimal" defaultValue={defaults.amount} placeholder={method === 'salary' ? '3000' : '40'} aria-invalid={Boolean(e.amount)} />
            {e.amount && <p className="text-destructive text-xs">{e.amount}</p>}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-effectiveFrom`}>Starting</Label>
          <Input id={`${uid}-effectiveFrom`} name="effectiveFrom" type="date" defaultValue={today} aria-invalid={Boolean(e.effectiveFrom)} required />
          {e.effectiveFrom && <p className="text-destructive text-xs">{e.effectiveFrom}</p>}
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">{METHOD_HELP[method]} Sessions before the start date keep the rate they had.</p>

      {method === 'per_session' && (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Different amounts for some session formats <span className="text-muted-foreground font-normal">(optional)</span></p>
          <input type="hidden" name="overrides" value={JSON.stringify(overrides)} />
          {overrides.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label={`Session format ${i + 1}`} value={o.formatName} maxLength={80} placeholder="Session format name" list={`${uid}-formats`}
                onChange={(ev) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, formatName: ev.target.value } : x)))} />
              <Input aria-label={`Amount for format ${i + 1}`} value={o.amount} inputMode="decimal" placeholder="$" className="w-28"
                onChange={(ev) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, amount: ev.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove this format" onClick={() => setOverrides(overrides.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
          ))}
          <datalist id={`${uid}-formats`}>{formatNames.map((n) => <option key={n} value={n} />)}</datalist>
          {overrides.length < 10 && (
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setOverrides([...overrides, { formatName: unused[0] ?? '', amount: '' }])}><Plus /> Add a format</Button>
          )}
          {e.overrides ? <p className="text-destructive text-xs">{e.overrides}</p> : <p className="text-muted-foreground text-xs">Matched on the format’s name in your coaching packages, like “Standard session”.</p>}
        </div>
      )}

      {method !== 'salary' && (
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="payForfeited" checked={forfeited} onChange={(ev) => setForfeited(ev.target.checked)} className="accent-primary mt-0.5 size-4" />
          <span>Pay for late cancellations<span className="text-muted-foreground block text-xs">When a family cancels too late and loses the credit, the coach is still paid for the session.</span></span>
        </label>
      )}

      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save pay rate'}</Button>
    </form>
  )
}

export function RemoveRateButton({ remove }: { remove: Action }) {
  const [state, action, pending] = useActionState(remove, {})
  return (
    <form action={action} className="flex items-center gap-2">
      {state.message && <span role="alert" className="text-destructive text-xs">{state.message}</span>}
      <Button type="submit" variant="ghost" size="sm" disabled={pending} className="text-muted-foreground">{pending ? 'Removing…' : 'Remove'}</Button>
    </form>
  )
}
