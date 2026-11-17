'use client'

import { useId, useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MAX_TEAM_SEATS, PAID_PLANS, bestYearlySaving, formatDollars, planTotalCents, type BillingInterval, type PaidPlan, type PlanId } from '@/lib/billing/plans'

const FEATURES: Record<PaidPlan, string[]> = {
  solo: ['Just you', 'Unlimited booking pages', 'Paid calls through your Stripe', 'Zoom meetings', 'Reminder emails 24 hours before each call', 'Clients, packages, credits and files', 'Family portal for parents'],
  team: ['Choose your team size, billed per person', 'Everything in Solo', 'Shared booking pages across coaches', 'Owner, administrator and coach roles', 'Team dashboard: intake, coach matching and finances'],
}

/** How many people to pay for on Team. Never fewer than the people already on the team. */
export function SeatPicker({ value, onChange, min, name = 'seats' }: { value: number; onChange: (n: number) => void; min: number; name?: string }) {
  const id = useId()
  const clamp = (n: number) => Math.min(MAX_TEAM_SEATS, Math.max(min, Number.isFinite(n) ? Math.round(n) : min))
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">Team size</label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon-sm" aria-label="One fewer person" disabled={value <= min} onClick={() => onChange(clamp(value - 1))}><Minus /></Button>
        <input id={id} name={name} type="number" inputMode="numeric" min={min} max={MAX_TEAM_SEATS} step={1} value={value}
          onChange={(ev) => onChange(ev.target.value === '' ? min : clamp(Number(ev.target.value)))}
          className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-20 rounded-md border bg-transparent px-2 text-center text-sm tabular-nums shadow-xs outline-none focus-visible:ring-[3px]" />
        <Button type="button" variant="outline" size="icon-sm" aria-label="One more person" disabled={value >= MAX_TEAM_SEATS} onClick={() => onChange(clamp(value + 1))}><Plus /></Button>
        <span className="text-muted-foreground text-sm">{value === 1 ? 'person' : 'people'}</span>
      </div>
      <p className="text-muted-foreground text-xs">Everyone with a login counts: you, administrators and coaches.{min > 1 ? ` You have ${min} on your team now.` : ''} Families never use a seat.</p>
    </div>
  )
}

export function PlanPicker({ current, currentInterval, people, teamSeatsNow, checkout, change }: {
  current: PlanId
  currentInterval: BillingInterval | null
  people: number
  /** Seats paid for, when the business is already on Team. */
  teamSeatsNow?: number
  checkout: (form: FormData) => Promise<void>
  change: (form: FormData) => Promise<void>
}) {
  const [interval, setInterval] = useState<BillingInterval>(currentInterval ?? 'year')
  // Buying Team: most teams buy for more than the owner, so start at two (or the team they already have).
  const [seats, setSeats] = useState(Math.max(people, 2))
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
          // On Team already, a yearly/monthly switch keeps the seats paid for (changed in "Team size" above).
          const choosingSeats = plan === 'team' && current !== 'team'
          const billedSeats = plan !== 'team' ? 1 : choosingSeats ? seats : Math.max(teamSeatsNow ?? people, people)
          const total = planTotalCents(plan, interval, billedSeats) / 100
          return (
            <div key={plan} className={cn('grid content-start gap-4 rounded-xl border p-5', isCurrent && 'border-primary ring-primary/20 ring-2')}>
              <div>
                <p className="font-semibold">{info.name}</p>
                <p className="mt-2"><span className="text-3xl font-semibold tracking-tight">${formatDollars(monthly)}</span>
                  <span className="text-muted-foreground text-sm"> /month{info.perPerson ? ' per person' : ''}</span></p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {interval === 'year' ? `Billed yearly: $${formatDollars(total)}` : `Billed monthly: $${formatDollars(total)}`}
                  {plan === 'team' && ` for ${billedSeats} ${billedSeats === 1 ? 'person' : 'people'}`}
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
                <form action={paid ? change : checkout} className="grid gap-3">
                  <input type="hidden" name="plan" value={plan} />
                  <input type="hidden" name="interval" value={interval} />
                  {choosingSeats && <SeatPicker value={seats} onChange={setSeats} min={Math.max(1, people)} />}
                  <SubmitButton className="w-full" variant={plan === 'team' || current === 'solo' ? 'default' : 'outline'} pendingLabel={paid ? 'Switching…' : 'Opening checkout…'}>
                    {paid ? `Switch to ${info.name}${current === plan ? (interval === 'year' ? ', yearly' : ', monthly') : ''}` : `Upgrade to ${info.name}${choosingSeats ? ` for ${seats} ${seats === 1 ? 'person' : 'people'}` : ''}`}
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

/** On Team: change how many people the subscription pays for. */
export function TeamSizeForm({ seats, people, interval, save }: { seats: number; people: number; interval: BillingInterval; save: (form: FormData) => Promise<void> }) {
  const [value, setValue] = useState(Math.max(seats, people))
  const each = PAID_PLANS.team.cents[interval]
  const diff = value - seats
  return (
    <form action={save} className="grid gap-3">
      <SeatPicker value={value} onChange={setValue} min={Math.max(1, people)} />
      <p className="text-sm">
        New bill: <span className="font-medium tabular-nums">${formatDollars(planTotalCents('team', interval, value) / 100)}</span>
        <span className="text-muted-foreground"> {interval === 'year' ? 'a year' : 'a month'} for {value} {value === 1 ? 'person' : 'people'}</span>
      </p>
      {diff !== 0 && (
        <p className="text-muted-foreground text-xs">
          {diff > 0 ? `Adding ${diff} ${diff === 1 ? 'seat' : 'seats'} is charged today for the rest of this ${interval === 'year' ? 'year' : 'month'}, at $${formatDollars(each / 100)} per person per ${interval}.`
            : `Removing ${-diff} ${diff === -1 ? 'seat' : 'seats'} leaves a credit for the unused time, taken off your next bill.`}
        </p>
      )}
      <SubmitButton className="justify-self-start" variant="outline" disabled={diff === 0} pendingLabel="Updating…">Update team size</SubmitButton>
    </form>
  )
}
