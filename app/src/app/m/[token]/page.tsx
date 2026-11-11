import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CircleCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { availableStarts, bookingIdFromToken, bookingView, bookingWindow } from '@/lib/booking/server'
import { formatCents, guestCanChange, refundOnCancel } from '@/lib/booking/policy'
import { LocalTime } from '@/app/b/[business]/[page]/booked/[id]/local-time'
import { cancelAsGuest, rescheduleAsGuest } from './actions'
import { CancelForm, RescheduleForm } from './forms'

export const metadata: Metadata = { title: 'Manage your booking', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ManageBookingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string; refund?: string }> }) {
  const [{ token }, { done, refund }] = await Promise.all([params, searchParams])
  const id = bookingIdFromToken(token)
  if (!id) notFound()
  const view = await bookingView(id)
  if (!view) notFound()
  const { booking, page } = view
  const now = new Date()
  const changeable = booking.status === 'confirmed' && guestCanChange(booking.startsAt, now)

  let starts: string[] = []
  if (changeable && page) {
    const { from, to } = bookingWindow(page, now)
    const result = await availableStarts(page, from, to, now, { ignoreBookingId: booking.id, hostMembershipId: booking.hostMembershipId })
    starts = result.calendarUnavailable ? [] : result.starts.filter((s) => s.getTime() !== booking.startsAt.getTime()).map((s) => s.toISOString())
  }

  const paid = booking.paymentStatus === 'paid'
  const refundPreview = refundOnCancel({ paid, cancelledBy: 'guest', startsAt: booking.startsAt, cutoffHours: booking.refundCutoffHours, now })
  const refundNote =
    refundPreview === 'full'
      ? `You’ll get a full refund of ${formatCents(booking.priceCents ?? 0)}.`
      : refundPreview === 'none'
        ? `It’s less than ${booking.refundCutoffHours} hours before the call, so the ${formatCents(booking.priceCents ?? 0)} payment won’t be refunded.`
        : ''

  return (
    <div className="mx-auto grid w-full max-w-lg gap-4">
      {done === 'cancelled' && (
        <Alert variant="success"><AlertDescription>Your call is cancelled.{booking.paymentStatus === 'refunded' ? ' A full refund is on its way to your card.' : ''}{refund === 'failed' ? ' We couldn’t refund your payment automatically; the business has been told and will sort it out.' : ''}</AlertDescription></Alert>
      )}
      {done === 'moved' && <Alert variant="success"><AlertDescription>Your call has a new time. We’ve emailed you the details.</AlertDescription></Alert>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {booking.status === 'cancelled' ? 'Cancelled call' : <><CircleCheck className="text-success size-5" /> {booking.title}</>}
          </CardTitle>
          <CardDescription>With {view.hostName} · {view.business.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <LocalTime start={booking.startsAt.toISOString()} end={booking.endsAt.toISOString()} zone={booking.guestTimezone} />
          {booking.status === 'confirmed' && booking.locationDetail && <p className="text-muted-foreground break-all">{booking.locationDetail}</p>}
          {!changeable && booking.status === 'confirmed' && <p className="text-muted-foreground">This call has started or finished, so it can’t be changed here.</p>}
        </CardContent>
      </Card>

      {changeable && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reschedule</CardTitle>
              <CardDescription>Pick a new time. {paid ? 'There’s no extra charge.' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <RescheduleForm starts={starts} action={rescheduleAsGuest.bind(null, token)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cancel</CardTitle>
            </CardHeader>
            <CardContent>
              <CancelForm action={cancelAsGuest.bind(null, token)} refundNote={refundNote} />
            </CardContent>
          </Card>
        </>
      )}
      <Link href={`/b/${view.business.slug}`} className="text-primary justify-self-center text-xs hover:underline">{view.business.name}</Link>
    </div>
  )
}
