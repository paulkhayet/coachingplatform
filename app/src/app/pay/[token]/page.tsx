import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CircleCheck, Clock } from 'lucide-react'
import { BusinessMark } from '@/components/business-mark'
import { Card, CardContent } from '@/components/ui/card'
import { formatCents } from '@/lib/booking/policy'
import { businessLogoUrl } from '@/lib/business-logo'
import { cadenceWord, describeInstalments } from '@/lib/clients/card-plan'
import { findPaymentRequest, syncPackageCheckout } from '@/lib/clients/card-payments'
import { formatServicePeriod } from '@/lib/clients/credits'
import { formatCredits } from '@/lib/coaching-packages'
import { startPayment } from './actions'
import { PayForm, type PayChoice } from './form'

export const metadata: Metadata = { title: 'Pay for coaching', robots: { index: false } }

/** A family pays for a package by card (D-076). Anyone with the link can pay; no account is needed. */
export default async function PayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ session_id?: string; cancelled?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams])
  // Back from Stripe: record the payment now if Stripe's webhook hasn't arrived yet.
  if (query.session_id) {
    try { await syncPackageCheckout(token, query.session_id) } catch (error) { console.error('Could not sync a package checkout', error instanceof Error ? error.message : 'unknown error') }
  }
  const found = await findPaymentRequest(token)
  if (!found) notFound()
  const { terms, status, request } = found
  const returned = Boolean(query.session_id)

  const choices: PayChoice[] = found.options.map((o) => o.kind === 'full'
    ? { value: 'full', title: found.paidCents > 0 ? `Pay the rest: ${formatCents(o.amountCents)}` : `Pay in full: ${formatCents(o.amountCents)}`, detail: 'One payment today.', button: `Pay ${formatCents(o.amountCents)}` }
    : { value: 'instalments', title: `Pay in ${o.count} ${o.cadence} instalments`, detail: `${describeInstalments(o, formatCents)}. Charged automatically to the same card until it’s paid.`, button: `Pay ${formatCents(o.firstCents)} now` })

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <BusinessMark name={found.businessName} logoUrl={businessLogoUrl(found.logoPath)} className="size-14 rounded-lg text-xl" />
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm break-words">{found.businessName}</p>
          <h1 className="text-2xl font-semibold tracking-tight break-words">{terms.name}</h1>
        </div>
      </div>
      <Card>
        <CardContent className="grid gap-5">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Student</dt><dd className="text-right font-medium break-words">{found.clientName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Covers</dt><dd className="text-right">{formatCredits(found.period.creditUnits)} · {formatServicePeriod(found.period.startsOn, found.period.endsOn)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Price</dt><dd className="text-right tabular-nums">{formatCents(terms.priceCents)}</dd></div>
            {found.paidCents > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Paid so far</dt><dd className="text-right tabular-nums">{formatCents(found.paidCents)}</dd></div>}
            <div className="flex justify-between gap-4 border-t pt-2 text-base"><dt className="font-medium">Still to pay</dt><dd className="text-right font-semibold tabular-nums">{formatCents(found.remainingCents)}</dd></div>
          </dl>

          {status === 'open' && !returned && <PayForm action={startPayment.bind(null, token)} choices={choices} />}
          {status === 'open' && returned && (
            <div className="grid justify-items-center gap-2 py-2 text-center" role="status">
              <Clock className="text-muted-foreground size-8" aria-hidden="true" />
              <p className="font-medium">We’re confirming your payment</p>
              <p className="text-muted-foreground text-sm">This usually takes a few seconds. Refresh this page in a moment; you won’t be charged twice.</p>
            </div>
          )}
          {status === 'paid' && (
            <div className="grid justify-items-center gap-2 py-2 text-center" role="status">
              <CircleCheck className="text-success size-10" aria-hidden="true" />
              <p className="text-lg font-semibold">{returned ? 'Thank you, you’re all paid' : 'This package is paid'}</p>
              <p className="text-muted-foreground text-sm">{found.businessName} has your payment, and {found.clientName}’s sessions are ready to book.</p>
            </div>
          )}
          {status === 'plan' && (
            <div className="grid justify-items-center gap-2 py-2 text-center" role="status">
              <CircleCheck className="text-success size-10" aria-hidden="true" />
              <p className="text-lg font-semibold">{returned ? 'Thank you, your plan is set up' : 'You’re paying in instalments'}</p>
              <p className="text-muted-foreground text-sm">
                {request.planStatus === 'past_due'
                  ? 'Your last instalment didn’t go through. Stripe will try the card again; contact the business if you need to change it.'
                  : `The rest is charged to the same card each ${cadenceWord(request.planCadence ?? 'monthly')} until ${formatCents(terms.priceCents)} is paid. We’ll email a receipt each time.`}
              </p>
            </div>
          )}
          {status === 'closed' && (
            <p className="text-muted-foreground text-sm">This payment link has been turned off. Contact {found.businessName} if you’d like to pay.</p>
          )}
        </CardContent>
      </Card>
      {query.cancelled && status === 'open' && <p className="text-muted-foreground text-center text-sm">You left the payment page, so nothing was charged.</p>}
    </div>
  )
}
