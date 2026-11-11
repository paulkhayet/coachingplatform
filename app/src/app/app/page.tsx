import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Circle, CircleCheck, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/components/copy-button'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canManagePayments, canManageTeam } from '@/lib/roles'
import { siteUrl } from '@/lib/env'
import { calendarAllowed, isGoogleCalendarConfigured, lookupConnection } from '@/lib/google/server'
import { getZoomConnection, isZoomConfigured } from '@/lib/zoom/server'
import { formatCents } from '@/lib/booking/policy'
import { zonedParts, zonedTime } from '@/lib/slots'

export const metadata: Metadata = { title: 'Today' }

function greeting(tz: string) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

interface Step {
  label: string
  detail: string
  done: boolean
  href: string
  action: string
  optional?: boolean
}

type Call = { id: string; title: string; guest_name: string; starts_at: string; ends_at: string; payment_status: string; price_cents: number | null; location_type: string; zoom_meeting_id: string | null }

export default async function TodayPage() {
  const { user, business, membership } = await requireWorkspace()
  const supabase = await createClient()
  const tz = business.timezone
  const now = new Date()
  const today = zonedParts(now, tz)
  const endOfToday = zonedTime(today.year, today.month, today.day + 1, 0, tz)
  const inAWeek = zonedTime(today.year, today.month, today.day + 7, 0, tz)
  const isOwner = canManageTeam(membership.role)
  const managesPayments = canManagePayments(membership)
  const googleOpen = isGoogleCalendarConfigured && calendarAllowed(user.email)

  // Everything below is read through row-level security as the signed-in person.
  const mine = () => supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('host_user_id', user.id).eq('status', 'confirmed').gt('ends_at', now.toISOString())
  const [schedule, pages, calls, todayCount, weekCount, stripe, members, invites, google, zoom] = await Promise.all([
    supabase.from('availability_schedules').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('booking_pages').select('id, title, slug').eq('business_id', business.id).eq('active', true).order('created_at').returns<{ id: string; title: string; slug: string }[]>(),
    supabase
      .from('bookings')
      .select('id, title, guest_name, starts_at, ends_at, payment_status, price_cents, location_type, zoom_meeting_id')
      .eq('business_id', business.id)
      .eq('host_user_id', user.id)
      .eq('status', 'confirmed')
      .gt('ends_at', now.toISOString())
      .order('starts_at')
      .limit(5)
      .returns<Call[]>(),
    mine().lt('starts_at', endOfToday.toISOString()),
    mine().lt('starts_at', inAWeek.toISOString()),
    managesPayments ? supabase.from('stripe_accounts').select('charges_enabled, disconnected_at').eq('business_id', business.id).maybeSingle<{ charges_enabled: boolean; disconnected_at: string | null }>() : Promise.resolve({ data: null }),
    isOwner ? supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'active') : Promise.resolve({ count: 0 }),
    isOwner ? supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('business_id', business.id).is('accepted_at', null) : Promise.resolve({ count: 0 }),
    googleOpen ? lookupConnection(user.id) : Promise.resolve({ connection: undefined, failed: false }),
    isZoomConfigured ? getZoomConnection(user.id).catch(() => undefined) : Promise.resolve(undefined),
  ])

  const livePages = pages.data ?? []
  const steps: Step[] = [
    { label: 'Check your weekly hours', detail: schedule.data ? 'Families can book you inside these hours.' : 'You’re bookable weekdays 9 to 5 until you change them.', done: Boolean(schedule.data), href: '/app/availability', action: 'Set hours' },
    { label: 'Create your first booking page', detail: 'A link families use to pick a time with you.', done: livePages.length > 0, href: '/app/booking-pages/new', action: 'Create page' },
  ]
  if (googleOpen) steps.push({ label: 'Connect Google Calendar', detail: 'Your busy times block bookings, and bookings land on your calendar.', done: google.connection?.status === 'active', href: '/app/settings/integrations', action: 'Connect' })
  if (isZoomConfigured) steps.push({ label: 'Connect Zoom', detail: 'Give each booking its own meeting link.', done: zoom?.status === 'active', href: '/app/settings/integrations', action: 'Connect', optional: true })
  if (managesPayments) steps.push({ label: 'Connect Stripe to take payments', detail: 'Charge for calls, paid straight to your account.', done: Boolean(stripe.data?.charges_enabled && !stripe.data.disconnected_at), href: '/app/settings/integrations#stripe-connect', action: 'Set up', optional: true })
  if (isOwner) steps.push({ label: 'Invite your team', detail: 'Add coaches and administrators by email.', done: (members.count ?? 0) > 1 || (invites.count ?? 0) > 0, href: '/app/team', action: 'Invite', optional: true })
  const doneCount = steps.filter((s) => s.done).length
  const setupDone = steps.every((s) => s.done || s.optional)

  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' })
  const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  const isToday = (iso: string) => new Date(iso) < endOfToday
  const bookingLink = `${siteUrl}/b/${business.slug}`

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting(tz)}, {user.fullName.split(' ')[0]}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz }).format(now)} · {business.name}</p>
      </div>

      {!(setupDone && doneCount === steps.length) && (
        <Card>
          <CardHeader>
            <CardTitle>{setupDone ? `${business.name} is ready to take bookings` : `Get ${business.name} ready`}</CardTitle>
            <CardDescription>{doneCount} of {steps.length} done{setupDone ? '. The rest are optional.' : '.'}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <div className="bg-muted mb-3 h-1.5 overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="Setup progress">
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            {steps.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-md py-2">
                {s.done ? <CircleCheck className="text-success size-5 shrink-0" aria-label="Done" /> : <Circle className="text-muted-foreground size-5 shrink-0" aria-label="Not done" />}
                <div className="grid min-w-0 flex-1">
                  <span className={s.done ? 'text-muted-foreground text-sm line-through' : 'text-sm font-medium'}>
                    {s.label}{s.optional && !s.done && <span className="text-muted-foreground font-normal"> (optional)</span>}
                  </span>
                  {!s.done && <span className="text-muted-foreground text-xs">{s.detail}</span>}
                </div>
                {!s.done && <Button asChild variant="outline" size="sm"><Link href={s.href}>{s.action}</Link></Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Your next calls</CardTitle>
            <CardDescription>{todayCount.count ?? 0} today · {weekCount.count ?? 0} in the next 7 days. Times are in {business.name}’s time zone.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(calls.data ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No calls booked yet. Share your booking link to get your first one.</p>
            ) : (
              (calls.data ?? []).map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-medium">{isToday(c.starts_at) ? 'Today' : day.format(new Date(c.starts_at))}</p>
                    <p className="text-muted-foreground text-xs">{time.format(new Date(c.starts_at))} – {time.format(new Date(c.ends_at))}</p>
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm">{c.title} with {c.guest_name}</p>
                  <div className="flex gap-1.5">
                    {c.payment_status === 'paid' && c.price_cents && <Badge variant="accent">Paid {formatCents(c.price_cents)}</Badge>}
                    {c.zoom_meeting_id && <Badge variant="outline">Zoom</Badge>}
                  </div>
                </div>
              ))
            )}
            <Link href="/app/bookings" className="text-primary flex items-center gap-1 justify-self-start text-sm hover:underline">All bookings <ArrowRight className="size-4" /></Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your booking link</CardTitle>
            <CardDescription>Share it on your website, in emails or on social media.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="bg-muted truncate rounded-md px-3 py-2 font-mono text-xs">{bookingLink.replace(/^https?:\/\//, '')}</p>
            <div className="flex gap-2">
              <CopyButton text={bookingLink} />
              <Button asChild variant="ghost" size="sm"><a href={`/b/${business.slug}`} target="_blank" rel="noreferrer">Open <ExternalLink /></a></Button>
            </div>
            {livePages.length > 0 && (
              <div className="grid gap-2 border-t pt-3">
                <p className="text-muted-foreground text-xs">Live pages</p>
                {livePages.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{p.title}</span>
                    <CopyButton text={`${bookingLink}/${p.slug}`} label="Copy" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
