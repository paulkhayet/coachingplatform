import type { Metadata } from 'next'
import { CalendarClock, Download, ExternalLink, FileText, MapPin, Phone, Video } from 'lucide-react'
import { BusinessMark } from '@/components/business-mark'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCents } from '@/lib/booking/policy'
import { businessLogoUrl } from '@/lib/business-logo'
import { availableCreditUnits, formatServicePeriod } from '@/lib/clients/credits'
import { formatFileSize } from '@/lib/clients/files'
import { formatCredits } from '@/lib/coaching-packages'
import { familyLinks } from '@/lib/family/access'
import { loadFamilyStudent, type FamilySession, type FamilyStudent } from '@/lib/family/dashboard'
import { openFamilyInvitesFor } from '@/lib/family/invitations'
import { getUser } from '@/lib/workspace'
import { FamilyJoinButton } from '../(auth)/family/join/form'

export const metadata: Metadata = { title: 'Home' }
export const dynamic = 'force-dynamic'

const isUrl = (value: string | null) => Boolean(value && /^https?:\/\//i.test(value))

function SessionRow({ s, timeZone, upcoming }: { s: FamilySession; timeZone: string; upcoming: boolean }) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' })
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  const covered = Boolean(s.credit_covered_at)
  const cancelled = s.status === 'cancelled'
  const Icon = s.location_type === 'phone' ? Phone : s.location_type === 'in_person' ? MapPin : Video
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="w-24 shrink-0">
        <p className="text-sm font-medium">{day.format(new Date(s.starts_at))}</p>
        <p className="text-muted-foreground text-xs">{time.format(new Date(s.starts_at))} – {time.format(new Date(s.ends_at))}</p>
      </div>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="text-sm font-medium">{s.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {cancelled ? <StatusBadge tone="neutral">{s.unpaid_cancelled ? 'Cancelled for nonpayment' : 'Cancelled'}</StatusBadge>
            : s.attended_at ? <StatusBadge tone="success">Attended</StatusBadge>
              : covered ? <StatusBadge tone="success">Paid</StatusBadge> : <StatusBadge tone="warning">Payment needed</StatusBadge>}
          {upcoming && !cancelled && s.location_detail && !isUrl(s.location_detail) && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs"><Icon className="size-3.5" /> {s.location_detail}</span>
          )}
          {upcoming && !cancelled && !covered && <span className="text-muted-foreground text-xs">Meeting details arrive once it’s paid.</span>}
        </div>
      </div>
      {upcoming && !cancelled && covered && isUrl(s.location_detail) && (
        <Button asChild size="sm"><a href={s.location_detail!} target="_blank" rel="noreferrer"><Video /> Join</a></Button>
      )}
    </li>
  )
}

function StudentCard({ student }: { student: FamilyStudent }) {
  const { link, client, business, coachName } = student
  const tz = business.timezone
  const zone = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value
  return (
    <section className="grid gap-4" aria-labelledby={`student-${client.id}`}>
      <div className="flex items-center gap-3">
        <BusinessMark name={business.name} logoUrl={businessLogoUrl(business.logo_path)} className="size-10 text-base" />
        <div className="min-w-0">
          <h2 id={`student-${client.id}`} className="text-lg font-semibold tracking-tight">{client.name}</h2>
          <p className="text-muted-foreground text-sm">{business.name}{coachName ? ` · Coach: ${coachName}` : ''}</p>
        </div>
      </div>
      {student.failed && <Alert variant="warning"><AlertDescription>Some details couldn’t load. Refresh to try again.</AlertDescription></Alert>}

      {link.can_view_sessions && (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4" /> Sessions</CardTitle>
            <CardDescription>Times are in {business.name}’s time zone ({zone}).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {student.upcoming.length ? (
              <section aria-label="Upcoming sessions">
                <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Upcoming</h3>
                <ul className="divide-y">{student.upcoming.map((s) => <SessionRow key={s.id} s={s} timeZone={tz} upcoming />)}</ul>
              </section>
            ) : <p className="text-muted-foreground text-sm">No upcoming sessions.</p>}
            {student.past.length > 0 && (
              <details>
                <summary className="text-muted-foreground cursor-pointer text-xs font-medium tracking-wide uppercase">Past sessions</summary>
                <ul className="mt-2 divide-y">{student.past.map((s) => <SessionRow key={s.id} s={s} timeZone={tz} upcoming={false} />)}</ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {link.can_view_credits && (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-base">Packages and credits</CardTitle>
            <CardDescription>Each session uses credits from the current package.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {student.credits.length === 0 && <p className="text-muted-foreground text-sm">No package yet.</p>}
            {student.credits.map((c) => {
              const due = c.priceCents != null ? Math.max(0, c.priceCents - (c.paid_cents ?? 0)) : null
              return (
                <div key={c.id} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-muted-foreground text-xs">{formatServicePeriod(c.starts_on, c.ends_on)}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div><dt className="text-muted-foreground text-xs">Available</dt><dd className="font-medium">{formatCredits(availableCreditUnits(c))}</dd></div>
                    <div><dt className="text-muted-foreground text-xs">Booked</dt><dd>{formatCredits(c.reserved_units)}</dd></div>
                    <div><dt className="text-muted-foreground text-xs">Used</dt><dd>{formatCredits(c.used_units)}</dd></div>
                    <div><dt className="text-muted-foreground text-xs">In package</dt><dd>{formatCredits(c.credit_units)}</dd></div>
                  </dl>
                  {due != null && (due > 0
                    ? <p className="text-sm"><StatusBadge tone="warning">{formatCents(due)} still due</StatusBadge> <span className="text-muted-foreground text-xs">of {formatCents(c.priceCents!)}. Pay {business.name} directly{business.contact_email ? ` (${business.contact_email})` : ''}.</span></p>
                    : <p className="text-sm"><StatusBadge tone="success">Paid in full</StatusBadge></p>)}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {student.files.length > 0 && (
        <Card className="gap-4">
          <CardHeader><CardTitle className="text-base">Shared files</CardTitle><CardDescription>Files the coach shared with your family.</CardDescription></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {student.files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                  <a href={`/app/files/${f.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{f.file_name}</a>
                  <span className="text-muted-foreground text-xs">{formatFileSize(f.size_bytes)}</span>
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${f.file_name}`}><a href={`/app/files/${f.id}`}><Download /></a></Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

export default async function FamilyHome() {
  const user = (await getUser())!
  const [links, invites] = await Promise.all([familyLinks(user.id), user.email_confirmed_at && user.email ? openFamilyInvitesFor(user.email) : []])
  const students = (await Promise.all(links.map(loadFamilyStudent))).filter((s): s is FamilyStudent => Boolean(s))
  const first = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{first ? `Hi ${first}` : 'Your family portal'}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Sessions, meeting links and credits for the students you follow.</p>
      </div>
      {invites.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">New invitations</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm"><strong>{inv.clientName}</strong> <span className="text-muted-foreground">with {inv.businessName}</span></p>
                <FamilyJoinButton accessId={inv.id} label="Accept" variant="outline" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {students.length === 0 && invites.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing here yet</CardTitle>
            <CardDescription>When a coaching business invites you to follow a student, it will appear here. Ask them to send the invitation to {user.email}.</CardDescription>
          </CardHeader>
        </Card>
      )}
      {students.map((s) => <StudentCard key={s.link.id} student={s} />)}
      {students.some((s) => s.business.contact_email) && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs"><ExternalLink className="size-3.5" /> Need to change something? Contact the coaching business; rescheduling from here is coming soon.</p>
      )}
    </div>
  )
}
