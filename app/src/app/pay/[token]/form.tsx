'use client'

import { useActionState, useState } from 'react'
import { Lock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PayState } from './actions'

export interface PayChoice { value: 'full' | 'instalments'; title: string; detail: string; button: string }

/** The family picks how to pay, then goes to Stripe's secure checkout. */
export function PayForm({ action, choices }: { action: (state: PayState, data: FormData) => Promise<PayState>; choices: PayChoice[] }) {
  const [state, submit, pending] = useActionState(action, {})
  const [choice, setChoice] = useState(choices[0].value)
  const selected = choices.find((c) => c.value === choice) ?? choices[0]
  return (
    <form action={submit} className="grid gap-4">
      {choices.length > 1 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">How would you like to pay?</legend>
          {choices.map((c) => (
            <label key={c.value} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors', choice === c.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}>
              <input type="radio" name="choice" value={c.value} checked={choice === c.value} onChange={() => setChoice(c.value)} className="accent-primary mt-1 size-4" />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{c.title}</span>
                <span className="text-muted-foreground text-sm">{c.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : <input type="hidden" name="choice" value={choices[0].value} />}
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" size="lg" disabled={pending}><Lock /> {pending ? 'Opening secure checkout…' : selected.button}</Button>
      <p className="text-muted-foreground text-center text-xs">You’ll pay on Stripe’s secure page. The money goes straight to the business.</p>
    </form>
  )
}
