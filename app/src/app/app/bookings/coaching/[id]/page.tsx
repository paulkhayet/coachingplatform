import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { coachOptions } from '@/app/app/booking-pages/hosts'
import { saveCoachingOutcome } from '@/app/app/clients/coaching-actions'
import { CoachingOutcomeForm } from '@/app/app/clients/coaching-forms'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { creditCancellationOutcome } from '@/lib/clients/session-policy'
import { formatCredits } from '@/lib/coaching-packages'
import { canManageClients } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'

export const metadata: Metadata = { title: 'Coaching session' }

type Row = {
  id: string; business_id: string; coaching_client_id: string; host_membership_id: string; host_user_id: string;
  guest_name: string; guest_email: string | null; title: string; starts_at: string; ends_at: string; status: string;
  credit_units: number; credit_notice_hours: number; credit_late_cancellation: 'preserve' | 'forfeit';
  credit_cancellation_outcome: 'released' | 'forfeited' | null; attended_at: string | null;
  location_type: 'video_link' | 'phone' | 'in_person' | 'zoom'; location_detail: string | null;
  calendar_sync_error: string | null; meeting_error: string | null; business: { timezone: string; name: string } | null;
}

const messages: Record<string, string> = { booked: 'Session booked. Credits are reserved.', attended: 'Attendance recorded. The reserved credits are now used.', cancelled: 'Session cancelled.' }

export default async function CoachingSessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { user, business, workspaces } = await requireWorkspace()
  const [{ id }, { status }] = await Promise.all([params, searchParams])
  if (!z.uuid().safeParse(id).success) notFound()
  const supabase = await createClient()
  const { data: session, error } = await supabase.from('bookings')
    .select('id, business_id, coaching_client_id, host_membership_id, host_user_id, guest_name, guest_email, title, starts_at, ends_at, status, credit_units, credit_notice_hours, credit_late_cancellation, credit_cancellation_outcome, attended_at, location_type, location_detail, calendar_sync_error, meeting_error, business:businesses(timezone,name)')
    .eq('id', id).not('coaching_client_id', 'is', null).maybeSingle<Row>()
  if (error) return <Alert variant="destructive"><AlertDescription>Couldn’t load this coaching session.</AlertDescription></Alert>
  if (!session) notFound()

  const activeWorkspace = workspaces.find((item) => item.businessId === session.business_id)
  if (!activeWorkspace) notFound()
  const sameBusiness = session.business_id === business.id
  const canManage = canManageClients(activeWorkspace.role) || session.host_user_id === user.id
  const [coaches, client] = await Promise.all([
    coachOptions(session.business_id),
    sameBusiness ? supabase.from('coaching_clients').select('id').eq('business_id', session.business_id).eq('id', session.coaching_client_id).maybeSingle<{ id: string }>() : { data: null },
  ])
  const coach = coaches.find((item) => item.id === session.host_membership_id)?.name ?? 'Unavailable coach'
  const timezone = session.business?.timezone ?? business.timezone
  const time = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const start = new Date(session.starts_at)
  const end = new Date(session.ends_at)
  const now = new Date()
  const cancelled = session.status === 'cancelled'
  const attended = Boolean(session.attended_at)
  const scheduled = !cancelled && !attended
  const credits = formatCredits(session.credit_units)
  const message = status && Object.hasOwn(messages, status) ? messages[status] : null
  const familyOutcome = creditCancellationOutcome({ by: 'guest', startsAt: start, now, noticeHours: session.credit_notice_hours, late: session.credit_late_cancellation })
  const video = session.location_type === 'zoom' || session.location_type === 'video_link'
  const joinUrl = video && session.location_detail && /^https?:\/\//i.test(session.location_detail) ? session.location_detail : null

  return (
    <div className="grid max-w-2xl gap-5">
      <div>
        <Link href={client.data ? `/app/clients/${client.data.id}` : '/app/bookings'} className="text-muted-foreground text-sm hover:underline">← {client.data ? session.guest_name : 'Bookings'}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{session.title} with {session.guest_name}</h1>
          <StatusBadge tone={cancelled ? 'neutral' : 'success'}>{cancelled ? 'Cancelled' : attended ? 'Attended' : 'Scheduled'}</StatusBadge>
        </div>
        {!sameBusiness && <p className="text-muted-foreground mt-1 text-sm">{activeWorkspace.name}</p>}
      </div>
      {message && <Alert variant="success"><AlertDescription>{message}</AlertDescription></Alert>}
      {session.meeting_error && scheduled && <Alert variant="warning"><AlertDescription>{session.meeting_error}</AlertDescription></Alert>}
      {session.calendar_sync_error && scheduled && <Alert variant="warning"><AlertDescription>{session.calendar_sync_error}</AlertDescription></Alert>}
      <Card className="gap-4">
        <CardHeader><h2 className="font-semibold">Session details</h2></CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-muted-foreground text-xs">Starts</dt><dd className="mt-0.5 text-sm">{time.format(start)}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Duration</dt><dd className="mt-0.5 text-sm">{Math.round((end.getTime() - start.getTime()) / 60000)} min</dd></div>
            <div><dt className="text-muted-foreground text-xs">Coach</dt><dd className="mt-0.5 text-sm break-words">{coach}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Credits</dt><dd className="mt-0.5 text-sm">{credits} {cancelled ? session.credit_cancellation_outcome : attended ? 'used' : 'reserved'}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Invited contact</dt><dd className="mt-0.5 text-sm break-all">{session.guest_email ?? 'No email recipient'}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Family cancellation</dt><dd className="mt-0.5 text-sm">{session.credit_notice_hours} hours’ notice · {session.credit_late_cancellation === 'forfeit' ? 'Forfeit credits if late' : 'Release credits if late'}</dd></div>
          </dl>
          {scheduled && joinUrl && <Button asChild variant="outline" size="sm" className="justify-self-start"><a href={joinUrl} target="_blank" rel="noreferrer">Open meeting link</a></Button>}
          {scheduled && !video && session.location_detail && <p className="text-sm break-words">{session.location_detail}</p>}
        </CardContent>
      </Card>
      {scheduled && canManage && <Card><CardContent><CoachingOutcomeForm action={saveCoachingOutcome.bind(null, session.business_id, session.id)} canAttend={end <= now} familyOutcome={familyOutcome} credits={credits} /></CardContent></Card>}
    </div>
  )
}
