import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Clock, MapPin, Phone, Video } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { availableStarts, bookingWindow, findPublicPage } from '@/lib/booking/server'
import { bookAction } from './actions'
import { SlotPicker } from './picker'

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
}

export default async function PublicBookingPage({ params }: { params: Promise<{ business: string; page: string }> }) {
  const { business, page } = await params
  const pub = await findPublicPage(business, page)
  if (!pub) notFound()
  const { from, to } = bookingWindow(pub.page)
  const { starts, calendarUnavailable } = await availableStarts(pub.page, from, to)
  const W = where[pub.page.locationType]

  return (
    <div className="grid gap-6 md:grid-cols-[17rem_1fr]">
      <div className="grid content-start gap-3">
        <p className="text-muted-foreground text-sm">{pub.business.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{pub.page.title}</h1>
        <div className="text-muted-foreground grid gap-1.5 text-sm">
          <span className="flex items-center gap-2"><Clock className="size-4" /> {pub.page.durationMinutes} minutes with {pub.hostName}</span>
          <span className="flex items-center gap-2"><W.icon className="size-4" /> {W.label}</span>
        </div>
        {pub.page.description && <p className="text-sm whitespace-pre-line">{pub.page.description}</p>}
      </div>
      <Card>
        <CardContent>
          {calendarUnavailable ? (
            <p className="text-muted-foreground text-sm">Times can’t be shown right now. Please try again in a few minutes.</p>
          ) : starts.length === 0 ? (
            <p className="text-muted-foreground text-sm">There are no open times in the next {Math.min(pub.page.windowDays, 60)} days. Please check back later.</p>
          ) : (
            <SlotPicker starts={starts.map((s) => s.toISOString())} durationMinutes={pub.page.durationMinutes} action={bookAction.bind(null, business, page)} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
