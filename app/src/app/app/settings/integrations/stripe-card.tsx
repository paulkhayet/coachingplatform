import Link from 'next/link'
import { CircleCheck, CreditCard, ExternalLink, Info, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmitButton } from '@/components/submit-button'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canManagePayments, canSeePayments } from '@/lib/roles'
import { paymentsStatus } from '@/lib/payments'
import { isStripeConfigured } from '@/lib/stripe/server'
import { PAYMENTS_PATH, refreshStripeAccount } from '@/lib/stripe/connect'
import { connectStripe } from '../payments/actions'

const errors: Record<string, string> = {
  forbidden: 'Only the owner, or an administrator the owner has trusted with finances, can connect Stripe.',
  setup: 'Stripe isn’t set up on this server yet. Try again once it’s available.',
  stripe: 'We couldn’t reach Stripe. Try again in a moment.',
  workspace: 'You switched businesses. Open Stripe setup from the correct workspace.',
}

type Row = {
  stripe_account_id: string
  livemode: boolean
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  disabled_reason: string | null
  requirements_due: number
  disconnected_at: string | null
}

const columns = 'stripe_account_id, livemode, details_submitted, charges_enabled, payouts_enabled, disabled_reason, requirements_due, disconnected_at'

export async function StripeCard({ returned, error }: { returned?: string; error?: string }) {
  const { business, membership } = await requireWorkspace()

  if (!canSeePayments(membership.role)) {
    return (
      <Card id="stripe-connect">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="size-5" /> Stripe</CardTitle>
          <CardDescription>Owners and administrators manage client payments for {business.name}.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const canManage = canManagePayments(membership)
  const supabase = await createClient()
  const load = async () => (await supabase.from('stripe_accounts').select(columns).eq('business_id', business.id).maybeSingle<Row>()).data
  let row = await load()
  // Coming back from Stripe: fetch the latest status now rather than waiting for the webhook.
  if (returned && row && canManage && isStripeConfigured) {
    try {
      await refreshStripeAccount(row.stripe_account_id)
      row = await load()
    } catch (e) {
      console.error('Refreshing the Stripe account failed', e)
    }
  }
  const status = paymentsStatus(row && { disconnectedAt: row.disconnected_at ? new Date(row.disconnected_at) : null, detailsSubmitted: row.details_submitted, chargesEnabled: row.charges_enabled })
  const dashboardUrl = row?.livemode ? 'https://dashboard.stripe.com/' : 'https://dashboard.stripe.com/test/dashboard'

  return (
    <Shell testMode={row ? !row.livemode : false}>
      {error && Object.hasOwn(errors, error) && (
        <Alert variant="destructive"><TriangleAlert /><AlertDescription>{errors[error]}</AlertDescription></Alert>
      )}
      {!isStripeConfigured && (
        <Alert variant="warning"><TriangleAlert /><AlertDescription>Stripe isn’t set up on this server yet, so connecting is turned off.</AlertDescription></Alert>
      )}

      {(status === 'not_connected' || status === 'disconnected') && (
        <Card>
          <CardHeader>
            <CardTitle>{status === 'disconnected' ? 'Stripe is disconnected' : 'Take payments with Stripe'}</CardTitle>
            <CardDescription>
              {status === 'disconnected'
                ? `${business.name} disconnected its Stripe account, so paid bookings are off. Connect again to turn them back on.`
                : `Connect a Stripe account so families can pay ${business.name} for paid bookings.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="text-muted-foreground grid gap-1.5 text-sm">
              <li>• Families pay {business.name} directly. The money goes to your Stripe account, never through schedulefa.st.</li>
              <li>• schedulefa.st takes no cut. You pay Stripe’s standard processing fees.</li>
              <li>• You handle payouts, refunds and disputes in your own Stripe Dashboard.</li>
              <li>• Already use Stripe? Sign in with it during setup to reuse your details.</li>
            </ul>
            {canManage ? (
              <form action={connectStripe.bind(null, business.id)}>
                <SubmitButton pendingLabel="Opening Stripe…" disabled={!isStripeConfigured}>{status === 'disconnected' ? 'Reconnect Stripe' : 'Connect Stripe'}</SubmitButton>
              </form>
            ) : (
              <p className="text-muted-foreground text-sm">Ask the owner to connect Stripe, or to trust you with finances.</p>
            )}
          </CardContent>
        </Card>
      )}

      {(status === 'onboarding' || status === 'restricted') && (
        <Card>
          <CardHeader>
            <CardTitle>{status === 'onboarding' ? 'Finish setting up Stripe' : 'Stripe needs more information'}</CardTitle>
            <CardDescription>
              {status === 'onboarding'
                ? 'Your Stripe account is created, but setup isn’t finished. Paid bookings turn on once it is.'
                : `Stripe hasn’t turned on payments yet${row?.requirements_due ? `: ${row.requirements_due} ${row.requirements_due === 1 ? 'item is' : 'items are'} still needed` : ', usually while it reviews your details'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canManage && <Button asChild><Link href={`${PAYMENTS_PATH}/onboarding`}>{status === 'onboarding' ? 'Continue setup' : 'Update details'}</Link></Button>}
            <Button asChild variant="outline"><a href={dashboardUrl} target="_blank" rel="noreferrer">Open Stripe Dashboard <ExternalLink /></a></Button>
          </CardContent>
        </Card>
      )}

      {status === 'active' && row && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CircleCheck className="text-success size-5" /> Ready to take payments</CardTitle>
            <CardDescription>Families can pay {business.name} through Stripe. Manage payouts, refunds and disputes in your Stripe Dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!row.payouts_enabled && (
              <Alert variant="info"><Info /><AlertDescription>Payouts to your bank aren’t on yet. Stripe will ask for anything it still needs.</AlertDescription></Alert>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline"><a href={dashboardUrl} target="_blank" rel="noreferrer">Open Stripe Dashboard <ExternalLink /></a></Button>
              <span className="text-muted-foreground font-mono text-xs">{row.stripe_account_id}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </Shell>
  )
}

function Shell({ children, testMode = false }: { children: React.ReactNode; testMode?: boolean }) {
  return (
    <section id="stripe-connect" className="grid scroll-mt-20 gap-4" aria-label="Stripe">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <CreditCard className="size-5" /> Stripe {testMode && <Badge variant="accent">Test mode</Badge>}
      </h2>
      {children}
    </section>
  )
}
