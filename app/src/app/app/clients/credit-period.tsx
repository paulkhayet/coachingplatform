import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AssignedPackageTerms } from '@/db/schema'
import { formatCents } from '@/lib/booking/policy'
import { availableCreditUnits, availablePurchasedUnits, formatClientDate, formatServicePeriod } from '@/lib/clients/credits'
import { formatCredits } from '@/lib/coaching-packages'
import { saveOfflinePayment } from './actions'
import { paymentMethodLabels, type CreditBalanceRow, type CreditEventRow, type CreditPaymentRow } from './data'
import { OfflinePaymentForm } from './forms'

const eventLabels: Record<CreditEventRow['kind'], string> = {
  funded: 'Credits funded', reserved: 'Credits reserved', released: 'Reservation released',
  used: 'Credits used', forfeited: 'Credits forfeited', expired: 'Credits expired',
}

export function CreditPeriod({ period, terms, events, payments, canBook, allowAdvance, canRecord, businessId, clientId, today, timezone }: {
  period: CreditBalanceRow; terms?: AssignedPackageTerms; events: CreditEventRow[]; payments: CreditPaymentRow[];
  canBook: boolean; allowAdvance: boolean; canRecord: boolean; businessId: string; clientId: string; today: string; timezone: string;
}) {
  const ended = today >= period.ends_on
  const upcoming = today < period.starts_on
  const expired = ended && period.expiration === 'end_of_term'
  const paid = period.paid_cents ?? 0
  const remaining = terms ? Math.max(0, terms.priceCents - paid) : 0
  const available = expired ? 0 : availableCreditUnits(period)
  const reservable = allowAdvance ? availablePurchasedUnits(period) : available
  const metrics = [
    { label: 'Funded', units: period.funded_units },
    { label: 'Reserved', units: period.reserved_units },
    { label: 'Used', units: period.used_units },
    { label: ended ? 'Remaining paid' : 'Paid and available', units: available },
  ]
  const formatActivityDate = new Intl.DateTimeFormat('en-US', { timeZone: timezone, dateStyle: 'medium' })

  return (
    <Card className="gap-4">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-semibold break-words">{period.name}</h3>
          <StatusBadge tone={ended || upcoming ? 'neutral' : period.funded_units > 0 ? 'success' : 'warning'}>
            {ended ? 'Ended' : upcoming ? 'Upcoming' : period.funded_units > 0 ? 'Funded' : 'Payment needed'}
          </StatusBadge>
        </div>
        <CardDescription>{formatServicePeriod(period.starts_on, period.ends_on)} · {formatCredits(period.credit_units)} {period.kind === 'monthly' ? 'this month' : 'in the bundle'}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="bg-muted/60 rounded-lg px-3 py-2.5">
              <dt className="text-muted-foreground text-xs">{metric.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{metric.units / 100}</dd>
            </div>
          ))}
        </dl>
        {period.unpaid_reserved_units > 0 && <p className="text-muted-foreground text-sm">Payment needed for {formatCredits(period.unpaid_reserved_units)} currently reserved.</p>}
        {canBook && !ended && terms?.sessionFormats.some((format) => format.creditUnits <= reservable) && (
          <Button asChild size="sm" className="justify-self-start"><Link href={`/app/clients/${clientId}/book?period=${period.id}`}>Book session</Link></Button>
        )}
        {period.forfeited_units > 0 && <p className="text-muted-foreground text-sm">{formatCredits(period.forfeited_units)} forfeited.</p>}
        {terms && (
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">{formatCents(paid)} received</span> · {formatCents(remaining)} remaining of {formatCents(terms.priceCents)}
          </p>
        )}
        {canRecord && remaining > 0 && (
          <details className="rounded-lg border px-3 py-2.5">
            <summary className="cursor-pointer text-sm font-medium">Record offline payment</summary>
            <div className="mt-3">
              <OfflinePaymentForm key={remaining} action={saveOfflinePayment.bind(null, businessId, clientId, period.id, randomUUID())}
                remainingCents={remaining} monthly={period.kind === 'monthly'} today={today} />
            </div>
          </details>
        )}
        {terms && (
          <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium">Package terms at assignment</summary>
            <div className="text-muted-foreground mt-2 grid gap-2 text-sm">
              <p>{terms.kind === 'monthly' ? 'Monthly package' : `${terms.termWeeks} weeks`} · {formatCents(terms.priceCents)}{terms.kind === 'monthly' ? ' per month' : terms.installmentCount ? ` upfront or ${terms.installmentCount} ${terms.installmentCadence} payments` : ' upfront'}</p>
              <ul className="grid gap-1">
                {terms.sessionFormats.map((format, index) => <li key={index}>{format.name} · {format.durationMinutes} min · {formatCredits(format.creditUnits)}</li>)}
              </ul>
              <p>Cancellation notice {terms.cancellationNoticeHours === null ? 'follows business policy' : `is ${terms.cancellationNoticeHours} hours`}. {terms.lateCancellation === 'inherit' ? 'Late cancellations follow business policy.' : terms.lateCancellation === 'forfeit' ? 'Late cancellations forfeit credits.' : 'Late cancellations preserve credits.'}</p>
              <p>{terms.expiration === 'end_of_term' ? 'Ordinary unused credits expire at period end.' : 'Expiration follows business policy.'} {terms.makeupExtensionDays === null ? 'Makeups follow business policy.' : terms.makeupExtensionDays === 0 ? 'Makeups stay within the period.' : `Eligible makeups can extend ${terms.makeupExtensionDays} days past period end.`}</p>
            </div>
          </details>
        )}
        {payments.length > 0 && (
          <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium">Recent payments</summary>
            <ul className="mt-2 divide-y text-sm">
              {payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p>{paymentMethodLabels[payment.method]}</p>
                    <p className="text-muted-foreground text-xs break-words">{formatClientDate(payment.received_on)}{payment.reference && ` · ${payment.reference}`}</p>
                  </div>
                  <span className="font-medium tabular-nums">{formatCents(payment.amount_cents)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <details className="border-t pt-3">
          <summary className="cursor-pointer text-sm font-medium">Recent credit activity</summary>
          {events.length === 0 ? <p className="text-muted-foreground mt-2 text-sm">No recent credit activity.</p> : (
            <ul className="mt-2 divide-y text-sm">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <div><p>{eventLabels[event.kind]}</p><p className="text-muted-foreground text-xs">{formatActivityDate.format(new Date(event.created_at))}</p></div>
                  <span className="font-medium tabular-nums">{formatCredits(event.credit_units)}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </CardContent>
    </Card>
  )
}
