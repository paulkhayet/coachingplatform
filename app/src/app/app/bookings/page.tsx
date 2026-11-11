import type { Metadata } from 'next'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canManageBookings } from '@/lib/roles'
import { cancelBookingAction } from '../booking-pages/actions'
import { formatCents } from '@/lib/booking/policy'
import { formatAnswer } from '@/lib/booking/questions'
import type { BookingAnswer } from '@/db/schema'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Bookings' }

type Row = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  guest_name: string
  guest_email: string | null
  guest_notes: string | null
  host_membership_id: string
  calendar_sync_error: string | null
  google_event_id: string | null
  price_cents: number | null
  payment_status: string
  answers: BookingAnswer[]
  business_id: string
  zoom_meeting_id: string | null
  meeting_error: string | null
  coaching_client_id: string | null
  business?: { name: string } | null
}

const COLUMNS = 'id, title, starts_at, ends_at, guest_name, guest_email, guest_notes, host_membership_id, calendar_sync_error, google_event_id, price_cents, payment_status, answers, business_id, zoom_meeting_id, meeting_error, coaching_client_id'

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { business, membership, user, workspaces } = await requireWorkspace()
  const multiBusiness = workspaces.length > 1
  // "All my calls": every upcoming call you host, in every business you work for (row-level security
  // still limits it to businesses you're an active member of).
  const mine = multiBusiness && (await searchParams).view === 'mine'
  const supabase = await createClient()
  const now = new Date().toISOString()
  const query = () => mine
    ? supabase.from('bookings').select(`${COLUMNS}, business:businesses(name)`).eq('host_user_id', user.id)
    : supabase.from('bookings').select(COLUMNS).eq('business_id', business.id)
  const [{ data: rows }, { data: past }] = await Promise.all([
    query().eq('status', 'confirmed').gt('ends_at', now).order('starts_at').limit(200).returns<Row[]>(),
    query().eq('status', 'confirmed').not('coaching_client_id', 'is', null).is('attended_at', null).lte('ends_at', now)
      .order('starts_at', { ascending: false }).limit(50).returns<Row[]>(),
  ])

  // Your own calls are shown in your own time zone; one business's calls in its time zone.
  const { data: schedule } = mine ? await supabase.from('availability_schedules').select('timezone').eq('user_id', user.id).maybeSingle<{ timezone: string }>() : { data: null }
  const timeZone = mine ? (schedule?.timezone ?? business.timezone) : business.timezone
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' })
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  const zone = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  // Hosts can always cancel their own calls; owners and administrators can cancel any in their business.
  const canCancel = (b: Row) => mine || canManageBookings(membership, b.host_membership_id)
  const needsAttendance = (past ?? []).filter(canCancel)

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {mine ? `Upcoming bookings you host across your businesses. Times are in your time zone (${zone}).` : `Upcoming calls and coaching sessions for ${business.name}. Times are in the business time zone (${zone}).`}
        </p>
      </div>
      {multiBusiness && (
        <nav className="bg-muted flex w-fit gap-1 rounded-lg p-1 text-sm" aria-label="Which calls">
          <Link href="/app/bookings" className={cn('rounded-md px-3 py-1.5', !mine ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground')} aria-current={!mine ? 'page' : undefined}>{business.name}</Link>
          <Link href="/app/bookings?view=mine" className={cn('rounded-md px-3 py-1.5', mine ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground')} aria-current={mine ? 'page' : undefined}>All my calls</Link>
        </nav>
      )}
      {needsAttendance.length > 0 && <Card>
        <CardHeader><h2 className="font-semibold">Needs attendance</h2></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {needsAttendance.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{b.title} with {b.guest_name}</p>
                  <p className="text-muted-foreground text-xs">{day.format(new Date(b.starts_at))} · {time.format(new Date(b.starts_at))}{mine && b.business ? ` · ${b.business.name}` : ''}</p>
                </div>
                <Button asChild variant="outline" size="sm"><Link href={`/app/bookings/coaching/${b.id}`}>Record outcome</Link></Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>}
      {!rows?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No upcoming bookings</CardTitle>
            <CardDescription>{mine ? 'When someone books a call with you in any of your businesses, it shows up here.' : 'When someone books through one of your pages, it shows up here.'}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((b) => (
            <Card key={b.id} className="py-4">
              <CardContent className="flex flex-wrap items-start gap-4">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-medium">{day.format(new Date(b.starts_at))}</p>
                  <p className="text-muted-foreground text-xs">{time.format(new Date(b.starts_at))} – {time.format(new Date(b.ends_at))}</p>
                </div>
                <div className="grid min-w-0 flex-1 gap-1">
                  {mine && b.business && <p className="text-primary text-xs font-medium">{b.business.name}</p>}
                  <p className="text-sm font-medium">{b.title} with {b.guest_name}</p>
                  <p className="text-muted-foreground truncate text-xs">{b.guest_email}</p>
                  {(b.answers ?? []).map((a) => <p key={a.questionId} className="text-xs"><span className="text-muted-foreground">{a.label}:</span> {formatAnswer(a.value)}</p>)}
                  {b.guest_notes && <p className="text-muted-foreground line-clamp-2 text-xs whitespace-pre-line">“{b.guest_notes}”</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {b.payment_status === 'paid' && b.price_cents && <Badge variant="accent">Paid {formatCents(b.price_cents)}</Badge>}
                    {b.google_event_id && <Badge variant="outline">On Google Calendar</Badge>}
                    {b.calendar_sync_error && <Badge variant="outline" className="text-warning"><TriangleAlert /> Not on Google Calendar</Badge>}
                    {b.coaching_client_id && <Badge variant="outline">Coaching session</Badge>}
                    {b.zoom_meeting_id && <Badge variant="outline">{b.guest_email ? 'Zoom link sent' : 'Zoom link ready'}</Badge>}
                    {b.meeting_error && <Badge variant="outline" className="text-warning" title={b.meeting_error}><TriangleAlert /> No Zoom link</Badge>}
                  </div>
                </div>
                {b.coaching_client_id ? (
                  <Button asChild variant="outline" size="sm"><Link href={`/app/bookings/coaching/${b.id}`}>View session</Link></Button>
                ) : canCancel(b) && (
                  <form action={cancelBookingAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <Button type="submit" variant="ghost" size="sm">{b.payment_status === 'paid' ? 'Cancel and refund' : 'Cancel'}</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
