import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { MapPin, Phone, Video } from 'lucide-react'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminDb } from '@/db/server'
import { clientCreditPeriods, memberships, profiles } from '@/db/schema'
import { businessDate } from '@/lib/clients/credits'
import { familyCancellationOutcome } from '@/lib/clients/session-policy'
import { familyCanMove } from '@/lib/clients/sessions'
import { familyLinks } from '@/lib/family/access'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/workspace'
import { familyCancel, familyMove } from '../../actions'
import { FamilyCancelForm, FamilyMoveForm } from '../../forms'

export const metadata: Metadata = { title: 'Session' }
export const dynamic = 'force-dynamic'

type Row = {
  id: string; business_id: string; coaching_client_id: string; credit_period_id: string; host_membership_id: string; title: string; starts_at: string; ends_at: string
  status: string; location_type: 'video_link' | 'phone' | 'in_person' | 'zoom'; location_detail: string | null; credit_covered_at: string | null; attended_at: string | null
  credit_notice_hours: number | null; credit_late_cancellation: 'preserve' | 'forfeit' | null; credit_cancellation_outcome: 'released' | 'forfeited' | null
}

const messages: Record<string, string> = {
  booked: 'Booked. You’ll get a confirmation email, and it’s on the coach’s calendar.',
  moved: 'Moved. You’ll get an email with the new time.',
  cancelled: 'Cancelled. The coach has been told.',
}

/** One session, for a parent or guardian: details, and moving or cancelling it when they're allowed to. */
export default async function FamilySessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const [{ id }, { status }, user] = await Promise.all([params, searchParams, getUser()])
  if (!user || !z.uuid().safeParse(id).success) notFound()
  // Row-level security: a guardian sees only sessions of students they follow, and only with "see sessions" on.
  const supabase = await createClient()
  const { data: s } = await supabase.from('bookings').select('id, business_id, coaching_client_id, credit_period_id, host_membership_id, title, starts_at, ends_at, status, location_type, location_detail, credit_covered_at, attended_at, credit_notice_hours, credit_late_cancellation, credit_cancellation_outcome')
    .eq('id', id).not('coaching_client_id', 'is', null).maybeSingle<Row>()
  if (!s) notFound()
  const link = (await familyLinks(user.id)).find((l) => l.client_id === s.coaching_client_id)
  if (!link) notFound()
  const [business, client, coach, period] = await Promise.all([
    supabase.from('businesses').select('name, timezone, contact_email').eq('id', s.business_id).maybeSingle<{ name: string; timezone: string; contact_email: string | null }>(),
    supabase.from('coaching_clients').select('name').eq('id', s.coaching_client_id).maybeSingle<{ name: string }>(),
    adminDb().select({ name: profiles.fullName }).from(memberships).innerJoin(profiles, eq(profiles.id, memberships.userId)).where(eq(memberships.id, s.host_membership_id)),
    adminDb().select({ endsOn: clientCreditPeriods.endsOn }).from(clientCreditPeriods).where(eq(clientCreditPeriods.id, s.credit_period_id)),
  ])
  const tz = business.data?.timezone ?? 'America/New_York'
  const now = new Date()
  const start = new Date(s.starts_at)
  const when = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const until = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  const upcoming = s.status === 'confirmed' && !s.attended_at && start > now
  const booking = { startsAt: start, creditNoticeHours: s.credit_notice_hours, creditLateCancellation: s.credit_late_cancellation, creditCoveredAt: s.credit_covered_at ? new Date(s.credit_covered_at) : null }
  const outcome = familyCancellationOutcome(booking, now)
  const canMove = upcoming && link.can_reschedule && familyCanMove(booking, now) && Boolean(period[0])
  const late = s.credit_notice_hours ?? 0
  const warning = !s.credit_covered_at ? 'This session isn’t paid yet, so no credit is used.'
    : outcome === 'forfeited' ? `This is less than ${late} hours before the session, so under the package’s rules the credit is used up even though it’s cancelled.`
      : 'The credit goes back to your package, so you can book another time.'
  const Icon = s.location_type === 'phone' ? Phone : s.location_type === 'in_person' ? MapPin : Video
  const isUrl = Boolean(s.location_detail && /^https?:\/\//i.test(s.location_detail))

  return (
    <div className="grid gap-6">
      <Link href="/family" className="text-muted-foreground text-sm hover:underline">← Family portal</Link>
      {status && Object.hasOwn(messages, status) && <Alert variant="success"><AlertDescription>{messages[status]}</AlertDescription></Alert>}
      <Card className="gap-4">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{s.title}</CardTitle>
            {s.status === 'cancelled' ? <StatusBadge tone="neutral">Cancelled{s.credit_cancellation_outcome === 'forfeited' ? ' · credit used' : ''}</StatusBadge>
              : s.attended_at ? <StatusBadge tone="success">Attended</StatusBadge>
                : s.credit_covered_at ? <StatusBadge tone="success">Paid</StatusBadge> : <StatusBadge tone="warning">Payment needed</StatusBadge>}
          </div>
          <CardDescription>{client.data?.name} with {coach[0]?.name ?? business.data?.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p className="font-medium">{when.format(start)} – {until.format(new Date(s.ends_at))}</p>
          {upcoming && s.credit_covered_at && s.location_detail && (isUrl
            ? <Button asChild size="sm" className="justify-self-start"><a href={s.location_detail} target="_blank" rel="noreferrer"><Video /> Join</a></Button>
            : <p className="text-muted-foreground flex items-center gap-1.5"><Icon className="size-4" /> {s.location_detail}</p>)}
          {upcoming && !s.credit_covered_at && <p className="text-muted-foreground">Meeting details arrive once it’s paid.</p>}
        </CardContent>
      </Card>

      {upcoming && link.can_reschedule && (
        <>
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-base">Move to another time</CardTitle>
              <CardDescription>{canMove ? `Pick a new time with the same coach. Times are in ${business.data?.name}’s time zone.` : 'It’s too close to the session to move it here. You can cancel it below, or contact the coaching business.'}</CardDescription>
            </CardHeader>
            {canMove && (
              <CardContent>
                <FamilyMoveForm action={familyMove.bind(null, s.id, s.starts_at)} timeZone={tz} today={businessDate(tz, now)} endsOn={period[0].endsOn} />
              </CardContent>
            )}
          </Card>
          <Card className="gap-4">
            <CardHeader><CardTitle className="text-base">Cancel</CardTitle></CardHeader>
            <CardContent><FamilyCancelForm action={familyCancel.bind(null, s.id)} outcome={outcome} warning={warning} /></CardContent>
          </Card>
        </>
      )}
      {upcoming && !link.can_reschedule && (
        <p className="text-muted-foreground text-sm">To change this session, contact {business.data?.name}{business.data?.contact_email ? ` at ${business.data.contact_email}` : ''}.</p>
      )}
    </div>
  )
}
