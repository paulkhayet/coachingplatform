import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { siteUrl } from '@/lib/env'
import { BookingPageForm, type PageDefaults } from '../form'
import { updateBookingPage } from '../actions'

export const metadata: Metadata = { title: 'Edit booking page' }

type Row = {
  id: string
  title: string
  slug: string
  description: string | null
  duration_minutes: number
  location_type: string
  location_detail: string | null
  min_notice_minutes: number
  window_days: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  active: boolean
}

export default async function EditBookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { business } = await requireWorkspace()
  const [{ id }, { saved }] = await Promise.all([params, searchParams])
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const supabase = await createClient()
  const { data: p } = await supabase.from('booking_pages').select('*').eq('id', id).eq('business_id', business.id).maybeSingle<Row>()
  if (!p) notFound()

  const defaults: PageDefaults = {
    title: p.title,
    slug: p.slug,
    description: p.description ?? '',
    durationMinutes: p.duration_minutes,
    locationType: p.location_type,
    locationDetail: p.location_detail ?? '',
    minNoticeMinutes: p.min_notice_minutes,
    windowDays: p.window_days,
    bufferBeforeMinutes: p.buffer_before_minutes,
    bufferAfterMinutes: p.buffer_after_minutes,
    active: p.active,
  }
  const publicUrl = `${siteUrl}/b/${business.slug}/${p.slug}`

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <Link href="/app/booking-pages" className="text-muted-foreground text-sm hover:underline">← Booking pages</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{p.title}</h1>
      </div>
      {saved && <Alert variant="success"><AlertDescription>Saved.</AlertDescription></Alert>}
      <Card className="py-4">
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">{publicUrl}</span>
          {p.active && <Button asChild variant="outline" size="sm"><a href={`/b/${business.slug}/${p.slug}`} target="_blank" rel="noreferrer">Open page <ExternalLink /></a></Button>}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <BookingPageForm key={p.slug} action={updateBookingPage.bind(null, p.id)} defaults={defaults} businessSlug={business.slug} submitLabel="Save changes" />
        </CardContent>
      </Card>
    </div>
  )
}
