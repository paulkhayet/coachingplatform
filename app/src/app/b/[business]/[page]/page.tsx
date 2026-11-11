import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Clock, CreditCard, MapPin, Phone, Video } from 'lucide-react'
import Link from 'next/link'
import { BusinessMark } from '@/components/business-mark'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { businessLogoUrl } from '@/lib/business-logo'
import { availableStarts, bookingWindow, findPublicPage, paymentAccount, releaseHold } from '@/lib/booking/server'
import { parseQuestions } from '@/lib/booking/questions'
import { formatCents } from '@/lib/booking/policy'
import { bookAction } from './actions'
import { BookingFlow } from './picker'

// Times change as people book, so never cache this page.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ business: string; page: string }> }): Promise<Metadata> {
  const { business, page } = await params
  const pub = await findPublicPage(business, page)
  return { title: pub ? `${pub.page.title} · ${pub.business.name}` : 'Not found' }
}

const where = {
  video_link: { icon: Video, label: 'Video call (link sent when you book)' },
  phone: { icon: Phone, label: 'Phone call' },
  in_person: { icon: MapPin, label: 'In person (address sent when you book)' },
  zoom: { icon: Video, label: 'Zoom call (link sent when you book)' },
}

export default async function PublicBookingPage({ params, searchParams }: { params: Promise<{ business: string; page: string }>; searchParams: Promise<{ payment?: string; hold?: string }> }) {
  const [{ business, page }, { payment, hold }] = await Promise.all([params, searchParams])
  const pub = await findPublicPage(business, page)
  if (!pub) notFound()
  // Back from Stripe without paying: free the held time straight away.
  if (payment === 'cancelled' && hold && /^[0-9a-f-]{36}$/.test(hold)) await releaseHold(hold)
  const price = pub.page.priceCents
  const paymentsOff = price != null && !(await paymentAccount(pub.business.id))
  const { from, to } = bookingWindow(pub.page)
  const { starts, calendarUnavailable } = paymentsOff ? { starts: [], calendarUnavailable: false } : await availableStarts(pub.page, from, to)
  const W = where[pub.page.locationType]

  // The call's details: always on the left, through every step of booking.
  const info = (
    <>
      <div className="flex items-center gap-2.5">
        <BusinessMark name={pub.business.name} logoUrl={businessLogoUrl(pub.business.logoPath)} className="size-9 text-sm" />
        <Link href={`/b/${pub.business.slug}`} className="text-muted-foreground text-sm font-medium hover:underline">{pub.business.name}</Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{pub.page.title}</h1>
      <div className="text-muted-foreground grid gap-2 text-sm">
        <span className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0" /> {pub.page.durationMinutes} minutes with {pub.shared ? `one of ${pub.business.name}’s coaches` : pub.hostName}</span>
        <span className="flex items-start gap-2"><W.icon className="mt-0.5 size-4 shrink-0" /> {W.label}</span>
        {price != null && (
          <span className="flex items-start gap-2"><CreditCard className="mt-0.5 size-4 shrink-0" /> {formatCents(price)}, paid when you book. Full refund if you cancel {pub.page.refundCutoffHours} hours or more before.</span>
        )}
      </div>
      {pub.page.description && <p className="text-sm whitespace-pre-line">{pub.page.description}</p>}
    </>
  )
  const unavailable = paymentsOff
    ? `This call can’t be booked online right now. Please contact ${pub.business.name}.`
    : calendarUnavailable
      ? 'Times can’t be shown right now. Please try again in a few minutes.'
      : starts.length === 0
        ? `There are no open times in the next ${Math.min(pub.page.windowDays, 60)} days. Please check back later.`
        : null

  if (unavailable) {
    return (
      <div className="bg-card text-card-foreground grid overflow-hidden rounded-xl border shadow-xs md:grid-cols-[19rem_1fr]">
        <div className="grid content-start gap-3 border-b p-6 md:border-r md:border-b-0">{info}</div>
        <div className="p-6"><p className="text-muted-foreground text-sm">{unavailable}</p></div>
      </div>
    )
  }
  return (
    <BookingFlow
      info={info}
      starts={starts.map((s) => s.toISOString())}
      durationMinutes={pub.page.durationMinutes}
      questions={parseQuestions(pub.page.questions)}
      askNotes={pub.page.askNotes}
      priceLabel={price != null ? formatCents(price) : undefined}
      notice={payment === 'cancelled' ? <Alert variant="info"><AlertDescription>Payment wasn’t completed, so nothing was booked. You can choose a time again.</AlertDescription></Alert> : undefined}
      action={bookAction.bind(null, business, page)}
    />
  )
}
