'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PAID_PLANS, bestYearlySaving, formatDollars, type BillingInterval, type PaidPlan, type PlanId } from '@/lib/billing/plans'

const FEATURES: Record<PaidPlan, string[]> = {
  solo: ['Just you', 'Unlimited booking pages', 'Paid calls through your Stripe', 'Zoom meetings', 'Reminder emails 24 hours before each call', 'Clients, packages, credits and files'],
  team: ['Everyone on your team, billed per person', 'Everything in Solo', 'Shared booking pages across coaches', 'Owner, administrator and coach roles'],
}

export function PlanPicker({ current, currentInterval, people, checkout, change }: {
  current: PlanId
  currentInterval: BillingInterval | null
  people: number
  checkout: (form: FormData) => Promise<void>
  change: (form: FormData) => Promise<void>
}) {
  const [interval, setInterval] = useState<BillingInterval>(currentInterval ?? 'year')
  const paid = current !== 'free'
  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Billing period" className="bg-muted inline-flex justify-self-start rounded-lg p-1 text-sm">
        {(['year', 'month'] as const).map((value) => (
          <button key={value} type="button" role="radio" aria-checked={interval === value} onClick={() => setInterval(value)}
            className={cn('rounded-md px-3 py-1.5 font-medium transition-colors', interval === value ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
            {value === 'year' ? 'Yearly' : 'Monthly'}{value === 'year' && bestYearlySaving() > 0 && <span className="text-primary ml-1.5 text-xs">Save up to {bestYearlySaving()}%</span>}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(['solo', 'team'] as const).map((plan) => {
          const info = PAID_PLANS[plan]
          const monthly = info.cents[interval] / (interval === 'year' ? 12 : 1) / 100
          const isCurrent = current === plan && currentInterval === interval
          const soloBlocked = plan === 'solo' && people > 1
          const total = plan === 'team' ? (info.cents[interval] * Math.max(1, people)) / 100 : info.cents[interval] / 100
          return (
            <div key={plan} className={cn('grid content-start gap-4 rounded-xl border p-5', isCurrent && 'border-primary ring-primary/20 ring-2')}>
              <div>
                <p className="font-semibold">{info.name}</p>
                <p className="mt-2"><span className="text-3xl font-semibold tracking-tight">${formatDollars(monthly)}</span>
                  <span className="text-muted-foreground text-sm"> /month{info.perPerson ? ' per person' : ''}</span></p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {interval === 'year' ? `Billed yearly: $${formatDollars(total)}` : `Billed monthly: $${formatDollars(total)}`}
                  {plan === 'team' && ` for ${Math.max(1, people)} ${people === 1 ? 'person' : 'people'} now`}
                </p>
              </div>
              <ul className="grid gap-1.5 text-sm">
                {FEATURES[plan].map((f) => <li key={f} className="flex gap-2"><Check className="text-primary mt-0.5 size-4 shrink-0" />{f}</li>)}
              </ul>
              {isCurrent ? (
                <Button variant="outline" disabled>Current plan</Button>
              ) : soloBlocked ? (
                <p className="text-muted-foreground text-xs">Solo is for one person. Remove other team members first, or choose Team.</p>
              ) : (
                <form action={paid ? change : checkout}>
                  <input type="hidden" name="plan" value={plan} />
                  <input type="hidden" name="interval" value={interval} />
                  <SubmitButton className="w-full" variant={plan === 'team' || current === 'solo' ? 'default' : 'outline'} pendingLabel={paid ? 'Switching…' : 'Opening checkout…'}>
                    {paid ? `Switch to ${info.name}${current === plan ? (interval === 'year' ? ', yearly' : ', monthly') : ''}` : `Upgrade to ${info.name}`}
                  </SubmitButton>
                </form>
              )}
            </div>
          )
        })}
      </div>
      {paid && <p className="text-muted-foreground text-xs">Switching takes effect now. You’re charged the prorated difference today, and unused time on a cheaper plan becomes credit.</p>}
    </div>
  )
}
