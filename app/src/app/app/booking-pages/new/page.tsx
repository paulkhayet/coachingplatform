import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { requireWorkspace } from '@/lib/workspace'
import { BookingPageForm, NEW_PAGE } from '../form'
import { createBookingPage } from '../actions'
import { paymentAccount } from '@/lib/booking/server'

export const metadata: Metadata = { title: 'New booking page' }

export default async function NewBookingPage() {
  const { business } = await requireWorkspace()
  const paymentsReady = Boolean(await paymentAccount(business.id))
  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <Link href="/app/booking-pages" className="text-muted-foreground text-sm hover:underline">← Booking pages</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New booking page</h1>
        <p className="text-muted-foreground mt-1 text-sm">You’ll be the host. Guests can book times inside your availability.</p>
      </div>
      <Card>
        <CardContent>
          <BookingPageForm action={createBookingPage} defaults={NEW_PAGE} businessSlug={business.slug} submitLabel="Create page" paymentsReady={paymentsReady} />
        </CardContent>
      </Card>
    </div>
  )
}
