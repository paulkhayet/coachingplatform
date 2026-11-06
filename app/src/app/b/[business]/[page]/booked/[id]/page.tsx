import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CircleCheck, Loader } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { bookingView, manageUrl, syncCheckout } from '@/lib/booking/server'
import { formatCents } from '@/lib/booking/policy'
import { LocalTime } from './local-time'

export const metadata: Metadata = { title: 'Your booking' }
export const dynamic = 'force-dynamic'

export default async function BookedPage({ params, searchParams }: { params: Promise<{ business: string; page: string; id: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const [{ business, id }, { session_id }] = await Promise.all([params, searchParams])
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  // Back from Stripe: confirm the payment now if the webhook hasn't arrived yet.
  if (session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id)) {
    try {
      await syncCheckout(id, session_id)
    } catch (error) {
      console.error('Checking the Checkout session failed', error)
    }
  }
  const view = await bookingView(id)
  if (!view || view.business.slug !== business) notFound()
  const { booking } = view

  if (booking.status === 'pending_payment') {
    return (
      <Card className="mx-auto w-full max-w-lg">
        {/* Check again shortly; payment confirmation usually takes a few seconds. */}
        <meta httpEquiv="refresh" content="3" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Loader className="size-5 animate-spin" /> Confirming your payment…</CardTitle>
          <CardDescription>This page updates by itself in a moment.</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  if (booking.status === 'expired') {
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle>This time wasn’t booked</CardTitle>
          <CardDescription>Payment wasn’t completed in time, so the time was released.</CardDescription>
        </CardHeader>
        <CardContent><Link href={`/b/${business}`} className="text-primary text-sm hover:underline">Choose another time</Link></CardContent>
      </Card>
    )
  }

  const cancelled = booking.status === 'cancelled'
  const manage = cancelled ? undefined : manageUrl(booking.id)
  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {cancelled ? 'This call was cancelled' : <><CircleCheck className="text-success size-5" /> You’re booked</>}
        </CardTitle>
        <CardDescription>
          {cancelled
            ? `${booking.title} with ${view.business.name} was cancelled.`
            : `${booking.title} with ${view.hostName} (${view.business.name}). A confirmation is on its way to ${booking.guestEmail}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <LocalTime start={booking.startsAt.toISOString()} end={booking.endsAt.toISOString()} fallbackZone={booking.guestTimezone ?? 'UTC'} />
        {booking.paymentStatus === 'paid' && booking.priceCents && <p className="text-muted-foreground">{formatCents(booking.priceCents)} paid by card.</p>}
        {booking.paymentStatus === 'refunded' && <p className="text-muted-foreground">Refunded in full.</p>}
        {!cancelled && booking.locationDetail && (
          <div>
            <p className="text-muted-foreground text-xs">{booking.locationType === 'in_person' ? 'Where' : booking.locationType === 'phone' ? 'How' : 'Join with'}</p>
            {/^https?:\/\//.test(booking.locationDetail) ? (
              <a href={booking.locationDetail} target="_blank" rel="noreferrer" className="text-primary break-all hover:underline">{booking.locationDetail}</a>
            ) : (
              <p className="whitespace-pre-line">{booking.locationDetail}</p>
            )}
          </div>
        )}
        {manage && <Button asChild variant="outline" className="justify-self-start"><a href={manage}>Reschedule or cancel</a></Button>}
        <Link href={`/b/${business}`} className="text-primary text-xs hover:underline">Back to {view.business.name}</Link>
      </CardContent>
    </Card>
  )
}
