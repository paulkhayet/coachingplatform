import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge, StatusBadge } from '@/components/ui/badge'
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
import { calendarRange, parseKey, shiftAnchor, toKey, todayIn, type CalendarDisplay } from '@/lib/calendar-view'
import { busyTimes } from '@/lib/google/calendar'
import { lookupConnection } from '@/lib/google/server'
import { merge, subtract, type Interval } from '@/lib/slots'
import { MonthView, WeekView, type CalendarEvent } from './calendar'

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
  credit_covered_at: string | null
  host_user_id: string
  business?: { name: string } | null
}

const COLUMNS = 'id, title, starts_at, ends_at, guest_name, guest_email, guest_notes, host_membership_id, host_user_id, calendar_sync_error, google_event_id, price_cents, payment_status, answers, business_id, zoom_meeting_id, meeting_error, coaching_client_id, credit_covered_at'

type Params = { view?: string; display?: string; date?: string; google?: string }

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { business, membership, user, workspaces } = await requireWorkspace()
  const params = await searchParams
  const multiBusiness = workspaces.length > 1
  // "All my calls": every upcoming call you host, in every business you work for (row-level security
  // still limits it to businesses you're an active member of).
  const mine = multiBusiness && params.view === 'mine'
  const display: CalendarDisplay = params.display === 'week' || params.display === 'month' ? params.display : 'list'
  const supabase = await createClient()
  const now = new Date().toISOString()
  const query = () => mine
    ? supabase.from('bookings').select(`${COLUMNS}, business:businesses(name)`).eq('host_user_id', user.id)
    : supabase.from('bookings').select(COLUMNS).eq('business_id', business.id)

  // Your own calls are shown in your own time zone; one business's calls in its time zone.
  const { data: schedule } = mine ? await supabase.from('availability_schedules').select('timezone').eq('user_id', user.id).maybeSingle<{ timezone: string }>() : { data: null }
  const timeZone = mine ? (schedule?.timezone ?? business.timezone) : business.timezone
  const today = todayIn(timeZone)
  const anchor = parseKey(params.date) ?? today
  const range = display === 'list' ? null : calendarRange(display, anchor, timeZone)

  // Google Calendar busy times (only the signed-in person's own, and only blocks, never event details).
  const { connection } = await lookupConnection(user.id)
  const googleReady = connection?.status === 'active' && connection.busyCalendarIds.length > 0
  const showGoogle = googleReady && params.google === '1' && Boolean(range)

  const [{ data: rows }, { data: past }, { data: calendarRows, error: calendarError }] = await Promise.all([
    query().eq('status', 'confirmed').gt('ends_at', now).order('starts_at').limit(200).returns<Row[]>(),
    query().eq('status', 'confirmed').not('coaching_client_id', 'is', null).is('attended_at', null).lte('ends_at', now)
      .order('starts_at', { ascending: false }).limit(50).returns<Row[]>(),
    range
      ? query().eq('status', 'confirmed').lt('starts_at', range.to.toISOString()).gt('ends_at', range.from.toISOString()).order('starts_at').limit(500).returns<Row[]>()
      : Promise.resolve({ data: null, error: null }),
  ])

  let busy: Interval[] = []
  let googleError = false
  if (showGoogle && range && connection) {
    try {
      // Your own bookings are already on your Google Calendar; don't show them twice.
      const own = (calendarRows ?? []).filter((b) => b.host_user_id === user.id).map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) }))
      busy = subtract(merge(await busyTimes(user.id, connection.busyCalendarIds, range.from, range.to)), own)
    } catch {
      googleError = true
    }
  }

  const href = (o: Partial<Params> = {}) => {
    const next: Params = { view: mine ? 'mine' : undefined, display: display === 'list' ? undefined : display, date: params.date, google: showGoogle ? '1' : undefined, ...o }
    const q = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][])
    return `/app/bookings${q.size ? `?${q}` : ''}`
  }
  const nowDate = new Date()
  const events: CalendarEvent[] = (calendarRows ?? []).map((b) => ({
    id: b.id,
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
    title: b.guest_name,
    detail: `${b.title}${mine && b.business ? ` · ${b.business.name}` : ''}`,
    tone: b.coaching_client_id ? (b.credit_covered_at ? 'coaching' : 'unpaid') : 'call',
    href: b.coaching_client_id ? `/app/bookings/coaching/${b.id}`
      : new Date(b.ends_at) > nowDate ? `${href({ display: 'list', date: undefined })}#booking-${b.id}` : undefined,
  }))
  const rangeLabel = range && (display === 'week'
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).formatRange(
      new Date(Date.UTC(range.days[0].year, range.days[0].month - 1, range.days[0].day)),
      new Date(Date.UTC(range.days[6].year, range.days[6].month - 1, range.days[6].day)))
    : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(anchor.year, anchor.month - 1, 1))))
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' })
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  const zone = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  // Hosts can always cancel their own calls; owners and administrators can cancel any in their business.
  const canCancel = (b: Row) => mine || canManageBookings(membership, b.host_membership_id)
  const needsOutcome = (past ?? []).filter(canCancel)

  // The week view fills the window (minus the 3.5rem app header and 4rem page padding) so the whole day
  // shows without scrolling; other views size to their content.
  const fillWindow = display === 'week'
  return (
    <div className={cn('grid gap-6', fillWindow && 'md:flex md:h-[calc(100svh-7.5rem)] md:min-h-[34rem] md:flex-col')}>
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

      <div className="flex flex-wrap items-center gap-3">
        <nav className="bg-muted flex w-fit gap-1 rounded-lg p-1 text-sm" aria-label="How to show bookings">
          {(['list', 'week', 'month'] as const).map((d) => (
            <Link key={d} href={href({ display: d === 'list' ? undefined : d, date: d === 'list' ? undefined : params.date })} aria-current={display === d ? 'page' : undefined}
              className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5', display === d ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
              {d === 'list' ? <List className="size-4" /> : d === 'week' ? <CalendarRange className="size-4" /> : <CalendarDays className="size-4" />}
              {d === 'list' ? 'List' : d === 'week' ? 'Week' : 'Month'}
            </Link>
          ))}
        </nav>
        {range && (
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon-sm"><Link href={href({ date: toKey(shiftAnchor(display as 'week' | 'month', anchor, -1)) })} aria-label={`Previous ${display}`}><ChevronLeft /></Link></Button>
            <Button asChild variant="outline" size="sm"><Link href={href({ date: undefined })}>Today</Link></Button>
            <Button asChild variant="outline" size="icon-sm"><Link href={href({ date: toKey(shiftAnchor(display as 'week' | 'month', anchor, 1)) })} aria-label={`Next ${display}`}><ChevronRight /></Link></Button>
            <h2 className="ml-2 text-sm font-semibold">{rangeLabel}</h2>
          </div>
        )}
        {range && (googleReady ? (
          <Link href={href({ google: showGoogle ? undefined : '1' })} role="switch" aria-checked={showGoogle}
            className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-2 text-sm">
            <span className={cn('relative h-5 w-9 rounded-full transition-colors', showGoogle ? 'bg-primary' : 'bg-input')}>
              <span className={cn('bg-background absolute top-0.5 size-4 rounded-full shadow-xs transition-all', showGoogle ? 'left-[18px]' : 'left-0.5')} />
            </span>
            Show my Google Calendar
          </Link>
        ) : (
          <Link href="/app/settings/integrations" className="text-muted-foreground hover:text-foreground ml-auto text-sm underline-offset-4 hover:underline">
            {connection?.status === 'needs_reconnect' ? 'Reconnect Google Calendar to show your events' : 'Connect Google Calendar to show your events'}
          </Link>
        ))}
      </div>

      {range ? (
        <div className={cn('grid gap-3', fillWindow && 'md:flex md:min-h-0 md:flex-1 md:flex-col')}>
          {calendarError && <Alert variant="destructive"><AlertDescription>Couldn’t load bookings for this {display}. Refresh to try again.</AlertDescription></Alert>}
          {googleError && <Alert variant="warning"><AlertDescription>Couldn’t read your Google Calendar right now, so busy times aren’t shown.</AlertDescription></Alert>}
          {display === 'week'
            ? <WeekView days={range.days} events={events} busy={busy} timeZone={timeZone} today={today} now={nowDate} />
            : <MonthView days={range.days} month={anchor.month} events={events} busy={busy} timeZone={timeZone} today={today} dayHref={(d) => href({ display: 'week', date: toKey(d) })} />}
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5"><span className="bg-primary size-2.5 rounded-sm" /> Booked call</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-violet-500" /> Coaching session</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-500" /> Payment needed</span>
            {showGoogle && <span className="flex items-center gap-1.5"><span className="border-muted-foreground/40 size-2.5 rounded-sm border border-dashed" /> Busy on your Google Calendar (times only, no details)</span>}
            <span>Times in {zone}.</span>
          </div>
        </div>
      ) : <>
      {needsOutcome.length > 0 && <Card>
        <CardHeader><h2 className="font-semibold">Sessions to review</h2></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {needsOutcome.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{b.title} with {b.guest_name}</p>
                  <p className="text-muted-foreground text-xs">{day.format(new Date(b.starts_at))} · {time.format(new Date(b.starts_at))}{mine && b.business ? ` · ${b.business.name}` : ''}</p>
                  {!b.credit_covered_at && <StatusBadge tone="warning">Unpaid reservation</StatusBadge>}
                </div>
                <Button asChild variant="outline" size="sm"><Link href={`/app/bookings/coaching/${b.id}`}>{b.credit_covered_at ? 'Record outcome' : 'View reservation'}</Link></Button>
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
            <Card key={b.id} id={`booking-${b.id}`} className="scroll-mt-20 py-4 target:ring-primary target:ring-2">
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
                    {b.coaching_client_id && <StatusBadge tone={b.credit_covered_at ? 'success' : 'warning'}>{b.credit_covered_at ? 'Covered' : 'Payment needed'}</StatusBadge>}
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
      </>}
    </div>
  )
}
