import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CircleCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { confirmationFor } from '@/lib/booking/server'
import { LocalTime } from './local-time'

export const metadata: Metadata = { title: 'Booking confirmed' }
export const dynamic = 'force-dynamic'

export default async function BookedPage({ params }: { params: Promise<{ business: string; page: string; id: string }> }) {
  const { business, id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const found = await confirmationFor(id)
  if (!found || found.businessSlug !== business) notFound()
  const { booking } = found
  const cancelled = booking.status === 'cancelled'

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {cancelled ? 'This call was cancelled' : <><CircleCheck className="text-success size-5" /> You’re booked</>}
        </CardTitle>
        <CardDescription>
          {cancelled ? `${found.businessName} cancelled this call.` : `${booking.title} with ${found.businessName}. A calendar invitation is on its way to ${booking.guestEmail}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <LocalTime start={booking.startsAt.toISOString()} end={booking.endsAt.toISOString()} fallbackZone={booking.guestTimezone ?? 'UTC'} />
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
        <p className="text-muted-foreground text-xs">Need to change it? Reply to the calendar invitation or contact {found.businessName}.</p>
        <Link href={`/b/${business}`} className="text-primary text-xs hover:underline">Back to {found.businessName}</Link>
      </CardContent>
    </Card>
  )
}
