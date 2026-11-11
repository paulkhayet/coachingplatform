import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { SubmitButton } from '@/components/submit-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { canManageTeam } from '@/lib/roles'
import { billingCustomer, workspaceSubscriptions } from '@/lib/stripe/billing'
import { isStripeConfigured, stripeLivemode } from '@/lib/stripe/server'
import { requireWorkspace } from '@/lib/workspace'
import { openBillingPortal } from './actions'

export const metadata: Metadata = { title: 'Subscription' }

const labels: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  unpaid: 'Unpaid',
  incomplete: 'Payment pending',
  paused: 'Paused',
  canceled: 'Cancelled',
  incomplete_expired: 'Expired',
}

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ business, membership }, { error }] = await Promise.all([requireWorkspace(), searchParams])
  if (!canManageTeam(membership.role)) notFound()
  let customer: string | null = null
  let subscriptions: Awaited<ReturnType<typeof workspaceSubscriptions>> = []
  let loadFailed = false
  try {
    customer = await billingCustomer(business.id)
    if (customer) subscriptions = await workspaceSubscriptions(customer)
  } catch {
    loadFailed = true
    console.error('Could not load workspace subscriptions')
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Subscription</CardTitle>
          {customer && !stripeLivemode && <StatusBadge tone="neutral">Test mode</StatusBadge>}
        </div>
        <CardDescription>Manage what {business.name} pays for schedulefa.st.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error === 'workspace' && <Alert variant="warning"><AlertDescription>You switched businesses. Open billing from the correct workspace.</AlertDescription></Alert>}
        {error === 'portal' && <Alert variant="warning"><AlertDescription>We couldn’t open Stripe Billing. Try again in a moment.</AlertDescription></Alert>}
        {loadFailed && <Alert variant="warning"><AlertDescription>We couldn’t check your subscription status. Refresh to try again.</AlertDescription></Alert>}
        {subscriptions.map(({ id, names, status }) => (
          <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
            <p className="text-sm font-medium">{names.join(' · ')}</p>
            <StatusBadge tone={status === 'active' || status === 'trialing' ? 'success' : 'warning'}>{labels[status] ?? 'Unknown status'}</StatusBadge>
          </div>
        ))}
        {!loadFailed && subscriptions.length === 0 && <p className="text-sm font-medium">{isStripeConfigured ? 'No paid subscription' : 'Billing unavailable on this deployment'}</p>}
        {customer ? (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-sm">Use Stripe Billing to manage your plan and payment method, or download invoices.</p>
            <form action={openBillingPortal.bind(null, business.id)}>
              <SubmitButton pendingLabel="Opening Stripe…">Manage billing <ExternalLink /></SubmitButton>
            </form>
          </div>
        ) : !loadFailed && (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-sm">Subscription management appears here once a billing account is linked to this workspace.</p>
            <Button asChild variant="outline" className="justify-self-start"><Link href="/#pricing">View plans</Link></Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
