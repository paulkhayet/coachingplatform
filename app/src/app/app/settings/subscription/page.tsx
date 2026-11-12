import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, count, eq } from 'drizzle-orm'
import { ExternalLink } from 'lucide-react'
import { SubmitButton } from '@/components/submit-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { bookingPages } from '@/db/schema'
import { adminDb } from '@/db/server'
import { FREE_PLAN_SUMMARY, PAID_PLANS, formatPlanPrice } from '@/lib/billing/plans'
import { activeMemberCount, refreshWorkspaceSubscription, workspacePlan } from '@/lib/billing/server'
import { canManageTeam } from '@/lib/roles'
import { billingCustomer } from '@/lib/stripe/billing'
import { isStripeConfigured, stripeLivemode } from '@/lib/stripe/server'
import { requireWorkspace } from '@/lib/workspace'
import { changePlan, openBillingPortal, startCheckout } from './actions'
import { PlanPicker } from './plan-picker'

export const metadata: Metadata = { title: 'Subscription' }

const statusLabels: Record<string, string> = {
  active: 'Active', trialing: 'Trial', past_due: 'Payment failed, retrying', unpaid: 'Unpaid', incomplete: 'Payment pending',
  paused: 'Paused', canceled: 'Cancelled', incomplete_expired: 'Expired',
}
const errors: Record<string, string> = {
  workspace: 'You switched businesses. Open Subscription again from the right business.',
  portal: 'We couldn’t open Stripe billing. Try again in a moment.',
  checkout: 'We couldn’t start checkout. Try again in a moment.',
  change: 'We couldn’t change your plan. Nothing was charged. Try again in a moment.',
  already: 'This business already has a paid plan. Switch plans below instead.',
  'no-subscription': 'There’s no subscription to change. Choose a plan below.',
  'solo-team': 'Solo is for one person, and your team has more. Choose Team, or remove members first.',
  unavailable: 'Billing isn’t set up on this deployment.',
}

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ error?: string; checkout?: string; changed?: string; portal?: string }> }) {
  const [{ business, membership }, params] = await Promise.all([requireWorkspace(), searchParams])
  if (!canManageTeam(membership.role)) notFound()
  // Coming back from Stripe: read the subscription now rather than waiting for the webhook.
  if (params.checkout === 'success' || params.portal) {
    try { await refreshWorkspaceSubscription(business.id) } catch { console.error('Could not refresh the workspace subscription') }
  }
  const [plan, people, customer, pages] = await Promise.all([
    workspacePlan(business.id),
    activeMemberCount(business.id),
    billingCustomer(business.id).catch(() => null),
    adminDb().select({ n: count() }).from(bookingPages).where(and(eq(bookingPages.businessId, business.id), eq(bookingPages.active, true))),
  ])
  const activePages = pages[0]?.n ?? 0
  const date = new Intl.DateTimeFormat('en-US', { timeZone: business.timezone, month: 'long', day: 'numeric', year: 'numeric' })
  const lapsed = plan.plan === 'free' && plan.subscribedPlan && plan.status && !['canceled', 'incomplete_expired'].includes(plan.status)

  return (
    <div className="grid max-w-3xl gap-5">
      {params.error && errors[params.error] && <Alert variant="warning"><AlertDescription>{errors[params.error]}</AlertDescription></Alert>}
      {params.checkout === 'success' && (plan.plan !== 'free'
        ? <Alert variant="success"><AlertDescription>Thanks! {business.name} is now on {PAID_PLANS[plan.plan].name}.</AlertDescription></Alert>
        : <Alert variant="info"><AlertDescription>Payment received. Your plan will update in a moment; refresh this page if it hasn’t.</AlertDescription></Alert>)}
      {params.changed && <Alert variant="success"><AlertDescription>Plan updated.</AlertDescription></Alert>}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Current plan</CardTitle>
            {isStripeConfigured && !stripeLivemode && <StatusBadge tone="neutral">Test mode</StatusBadge>}
          </div>
          <CardDescription>What {business.name} pays for schedulefa.st.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-semibold">{plan.plan === 'free' ? 'Free' : PAID_PLANS[plan.plan].name}</p>
            {plan.source === 'complimentary' && <StatusBadge tone="success">Complimentary</StatusBadge>}
            {plan.source === 'stripe' && plan.status && <StatusBadge tone={plan.plan !== 'free' && plan.status !== 'past_due' ? 'success' : 'warning'}>{statusLabels[plan.status] ?? plan.status}</StatusBadge>}
          </div>
          {plan.plan === 'free' ? (
            <div className="grid gap-1 text-sm">
              <p>{FREE_PLAN_SUMMARY}</p>
              <p className="text-muted-foreground">Using {people} of 1 person · {activePages} of 1 active booking page</p>
              {lapsed && <p className="text-destructive">Your {PAID_PLANS[plan.subscribedPlan!].name} subscription isn’t active ({statusLabels[plan.status!] ?? plan.status}). Update your card in Stripe billing to restore it.</p>}
            </div>
          ) : (
            <div className="grid gap-1 text-sm">
              {plan.interval && plan.source === 'stripe' && <p>{formatPlanPrice(plan.plan, plan.interval)}{plan.plan === 'team' && ` · ${plan.seats} ${plan.seats === 1 ? 'person' : 'people'}`}</p>}
              {plan.plan === 'team' && <p className="text-muted-foreground">Billed for everyone on your team. Adding someone is charged right away, prorated; removing someone leaves a credit.</p>}
              {plan.currentPeriodEnd && <p className="text-muted-foreground">{plan.cancelAtPeriodEnd ? `Cancelled: stays active until ${date.format(plan.currentPeriodEnd)}, then returns to Free.` : `Renews ${date.format(plan.currentPeriodEnd)}.`}</p>}
            </div>
          )}
          {customer && (
            <form action={openBillingPortal.bind(null, business.id)} className="flex flex-wrap items-center gap-3">
              <SubmitButton variant="outline" pendingLabel="Opening Stripe…">Manage billing <ExternalLink /></SubmitButton>
              <span className="text-muted-foreground text-xs">Card, billing details, invoices and cancelling.</span>
            </form>
          )}
        </CardContent>
      </Card>

      {plan.source !== 'complimentary' && isStripeConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>{plan.plan === 'free' ? 'Upgrade' : 'Change plan'}</CardTitle>
            <CardDescription>No fee on what families pay you. Cancel any time; you keep the plan until the end of the period you paid for.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanPicker current={plan.plan} currentInterval={plan.interval} people={people}
              checkout={startCheckout.bind(null, business.id)} change={changePlan.bind(null, business.id)} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
