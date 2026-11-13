import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { BookingAnswer, InquiryEventKind, InquiryStage } from '@/db/schema'
import { workspacePlan } from '@/lib/billing/server'
import { formatAnswer } from '@/lib/booking/questions'
import { businessDate, formatClientDate } from '@/lib/clients/credits'
import { rankCoaches } from '@/lib/insights/matching'
import { loadCoachLoads, loadTeam } from '@/lib/insights/server'
import { STAGE_LABELS, daysSince, isOpenStage, isSelf, outcomeLabel } from '@/lib/intake/shared'
import { createClient } from '@/lib/supabase/server'
import { US_TIME_ZONES } from '@/lib/validation'
import { isZoomConfigured, withoutZoom } from '@/lib/zoom/server'
import { cn } from '@/lib/utils'
import { requireDashboard } from '../../guard'
import { addNote, assignStaff, bookFirstCall, convertToClient, moveStage, saveFirstCallOutcome, saveInquiry, saveNextAction } from '../actions'
import { AssignForm, ConvertForm, FirstCallForm, InquiryForm, LostForm, NextActionForm, NoteForm, OutcomeForm, ProposeButton, StageButton, StageSelect } from '../forms'

export const metadata: Metadata = { title: 'Inquiry' }

type InquiryRow = {
  id: string; stage: InquiryStage; contact_name: string; contact_email: string; contact_phone: string | null; relationship: string | null
  student_name: string; student_grade: string | null; subjects: string[]; goals: string | null; availability_notes: string | null; timezone: string | null
  answers: BookingAnswer[]; source: 'form' | 'staff'; owner_membership_id: string | null; coach_membership_id: string | null
  first_call_booking_id: string | null; client_id: string | null; lost_reason: string | null; next_action: string | null; next_action_due: string | null
  stage_changed_at: string; created_at: string
}
type EventRow = { id: string; actor_id: string | null; kind: InquiryEventKind; data: Record<string, unknown>; created_at: string }
type CallRow = { id: string; starts_at: string; ends_at: string; status: string; location_type: string; location_detail: string | null; host_membership_id: string }

const messages: Record<string, string> = { 'call-booked': 'First call booked. The family and the coach have been emailed.' }
const stageTone: Record<InquiryStage, Tone> = { new: 'info', matching: 'warning', first_call: 'info', offer: 'info', enrolled: 'success', lost: 'neutral' }
const reasonTone = { good: 'text-success', warn: 'text-warning', neutral: 'text-muted-foreground' }

export default async function InquiryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const access = await requireDashboard('member')
  const { business, membership } = access
  const [{ id }, { status }] = await Promise.all([params, searchParams])
  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createClient()
  // Row-level security decides who gets this far: owners, administrators, or the proposed coach.
  const { data: inquiry, error } = await supabase.from('inquiries').select('*').eq('id', id).eq('business_id', business.id).maybeSingle<InquiryRow>()
  if (error) return <Alert variant="destructive"><AlertDescription>Couldn’t load this inquiry. Refresh the page to try again.</AlertDescription></Alert>
  if (!inquiry) notFound()

  const manager = access.manager
  const [events, team, call, duplicates, loads, plan] = await Promise.all([
    supabase.from('inquiry_events').select('id, actor_id, kind, data, created_at').eq('business_id', business.id).eq('inquiry_id', id).order('created_at').returns<EventRow[]>(),
    loadTeam(business.id),
    inquiry.first_call_booking_id
      ? supabase.from('bookings').select('id, starts_at, ends_at, status, location_type, location_detail, host_membership_id').eq('id', inquiry.first_call_booking_id).maybeSingle<CallRow>()
      : { data: null },
    manager ? supabase.from('inquiries').select('id, student_name, stage').eq('business_id', business.id).eq('contact_email', inquiry.contact_email).neq('id', id).limit(5).returns<{ id: string; student_name: string; stage: InquiryStage }[]>() : { data: [] },
    manager && isOpenStage(inquiry.stage) ? loadCoachLoads(business.id) : [],
    workspacePlan(business.id),
  ])

  const byMembership = new Map(team.map((m) => [m.id, m.name]))
  const byUser = new Map(team.map((m) => [m.userId, m.name]))
  const member = (value: unknown) => (typeof value === 'string' ? byMembership.get(value) ?? 'a former team member' : null)
  const actor = (e: EventRow) => (e.actor_id ? byUser.get(e.actor_id) ?? 'Someone' : null)
  const now = new Date()
  const today = businessDate(business.timezone, now)
  const dateTime = new Intl.DateTimeFormat('en-US', { timeZone: business.timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const callTime = new Intl.DateTimeFormat('en-US', { timeZone: business.timezone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

  const open = isOpenStage(inquiry.stage)
  const self = isSelf(inquiry.relationship)
  const coachName = inquiry.coach_membership_id ? byMembership.get(inquiry.coach_membership_id) ?? null : null
  const firstCall = call.data
  const callUpcoming = firstCall?.status === 'confirmed' && new Date(firstCall.ends_at) > now
  const callHappened = firstCall?.status === 'confirmed' && new Date(firstCall.ends_at) <= now
  const lastOutcome = [...(events.data ?? [])].reverse().find((e) => e.kind === 'first_call_outcome' && (!firstCall || e.data.bookingId === firstCall.id))
  const canRecord = Boolean(firstCall) && (manager || inquiry.coach_membership_id === membership.id)
  const suggestions = rankCoaches({ subjects: inquiry.subjects }, loads).slice(0, 3)
  const zoomAvailable = Boolean(manager && inquiry.coach_membership_id && plan.limits.zoom && isZoomConfigured && (await withoutZoom([inquiry.coach_membership_id])).length === 0)
  const bind = <T extends unknown[], R>(fn: (businessId: string, inquiryId: string, ...rest: T) => R) => fn.bind(null, business.id, id) as (...rest: T) => R

  const describe = (e: EventRow): { text: React.ReactNode; body?: string } | null => {
    const who = actor(e)
    const d = e.data
    switch (e.kind) {
      case 'created': return { text: d.source === 'form' ? 'Sent through the inquiry form' : <>{who ?? 'Staff'} added this inquiry</> }
      case 'stage':
        if (d.to === 'enrolled') return null
        if (d.to === 'lost') return { text: <>{who ?? 'Someone'} closed this as lost</>, body: typeof d.reason === 'string' ? d.reason : undefined }
        return { text: <>{who ?? 'Someone'} moved this to <span className="font-medium">{STAGE_LABELS[d.to as InquiryStage] ?? String(d.to)}</span></> }
      case 'assigned': {
        const parts: string[] = []
        if (d.coachTo !== d.coachFrom) parts.push(d.coachTo ? `proposed ${member(d.coachTo)} as the coach` : 'removed the proposed coach')
        if (d.ownerTo !== d.ownerFrom) parts.push(d.ownerTo ? `passed this to ${member(d.ownerTo)}` : 'left this with nobody')
        return parts.length ? { text: <>{who ?? 'Someone'} {parts.join(' and ')}</> } : null
      }
      case 'note': return { text: <>{who ?? 'Someone'} added a note</>, body: typeof d.text === 'string' ? d.text : undefined }
      case 'first_call_booked': return { text: <>{who ?? 'Someone'} booked a first call{typeof d.startsAt === 'string' && ` for ${callTime.format(new Date(d.startsAt))}`}{d.coachId ? ` with ${member(d.coachId)}` : ''}</> }
      case 'first_call_outcome': return { text: <>{who ?? 'Someone'} recorded the first call: <span className="font-medium">{outcomeLabel(d.outcome)}</span></>, body: typeof d.note === 'string' ? d.note : undefined }
      case 'converted': return { text: <>{who ?? 'Someone'} enrolled {inquiry.student_name} as a client</> }
    }
  }
  const timeline = (events.data ?? []).flatMap((e) => {
    const line = describe(e)
    return line ? [{ id: e.id, at: e.created_at, ...line }] : []
  })

  return (
    <div className="grid gap-5">
      <div>
        <Link href="/app/dashboard/intake" className="text-muted-foreground text-sm hover:underline">← {manager ? 'Intake' : 'Inquiries'}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{inquiry.student_name}</h1>
          <StatusBadge tone={stageTone[inquiry.stage]}>{STAGE_LABELS[inquiry.stage]}</StatusBadge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {inquiry.source === 'form' ? 'From the inquiry form' : 'Added by staff'} on {formatClientDate(businessDate(business.timezone, new Date(inquiry.created_at)))}
          {open && ` · ${daysSince(new Date(inquiry.stage_changed_at), now)} days in this stage`}
        </p>
      </div>
      {status && Object.hasOwn(messages, status) && <Alert variant="success"><AlertDescription>{messages[status]}</AlertDescription></Alert>}
      {(duplicates.data?.length ?? 0) > 0 && (
        <Alert variant="info"><AlertDescription>
          <p>Another inquiry from this email already exists: {duplicates.data!.map((dup, i) => (
            <span key={dup.id}>{i > 0 && ', '}<Link href={`/app/dashboard/intake/${dup.id}`} className="text-primary hover:underline">{dup.student_name} ({STAGE_LABELS[dup.stage]})</Link></span>
          ))}.</p>
        </AlertDescription></Alert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid gap-5">
          <Card className="gap-4">
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-muted-foreground text-xs">{self ? 'Student (wrote in themself)' : 'Family contact'}</dt>
                  <dd className="mt-0.5 text-sm break-words">{inquiry.contact_name}{!self && inquiry.relationship && <span className="text-muted-foreground"> · {inquiry.relationship}</span>}</dd>
                  <dd className="text-sm break-all"><a href={`mailto:${inquiry.contact_email}`} className="text-primary hover:underline">{inquiry.contact_email}</a></dd>
                  {inquiry.contact_phone && <dd className="text-sm"><a href={`tel:${inquiry.contact_phone}`} className="hover:underline">{inquiry.contact_phone}</a></dd>}
                </div>
                <div><dt className="text-muted-foreground text-xs">Student</dt>
                  <dd className="mt-0.5 text-sm break-words">{inquiry.student_name}{inquiry.student_grade && <span className="text-muted-foreground"> · {inquiry.student_grade}</span>}</dd>
                  {inquiry.timezone && <dd className="text-muted-foreground text-sm">{inquiry.timezone.replace(/_/g, ' ')}</dd>}
                </div>
                <div className="sm:col-span-2"><dt className="text-muted-foreground text-xs">Subjects</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">{inquiry.subjects.length ? inquiry.subjects.map((s) => <Badge key={s} variant="accent">{s}</Badge>) : <span className="text-muted-foreground text-sm">None given</span>}</dd>
                </div>
                {inquiry.goals && <div className="sm:col-span-2"><dt className="text-muted-foreground text-xs">Goals</dt><dd className="mt-0.5 text-sm whitespace-pre-line break-words">{inquiry.goals}</dd></div>}
                {inquiry.availability_notes && <div className="sm:col-span-2"><dt className="text-muted-foreground text-xs">When they’re free</dt><dd className="mt-0.5 text-sm whitespace-pre-line break-words">{inquiry.availability_notes}</dd></div>}
                {inquiry.answers.map((a) => (
                  <div key={a.questionId} className="sm:col-span-2"><dt className="text-muted-foreground text-xs">{a.label}</dt><dd className="mt-0.5 text-sm whitespace-pre-line break-words">{formatAnswer(a.value)}</dd></div>
                ))}
              </dl>
              {manager && inquiry.stage !== 'enrolled' && (
                <details className="border-t pt-3">
                  <summary className="cursor-pointer text-sm font-medium">Edit details</summary>
                  <div className="mt-4">
                    <InquiryForm action={bind(saveInquiry)} submitLabel="Save details" timezones={US_TIME_ZONES.map((z) => z.value)} defaults={{
                      contactName: inquiry.contact_name, contactEmail: inquiry.contact_email, contactPhone: inquiry.contact_phone ?? '', relationship: inquiry.relationship ?? 'Parent',
                      studentName: inquiry.student_name, studentGrade: inquiry.student_grade ?? '', subjects: inquiry.subjects.join(', '), goals: inquiry.goals ?? '',
                      availabilityNotes: inquiry.availability_notes ?? '', timezone: inquiry.timezone ?? business.timezone,
                    }} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <ol className="grid gap-3">
                {timeline.map((t) => (
                  <li key={t.id} className="border-border grid gap-1 border-l-2 pl-3">
                    <p className="text-sm">{t.text}</p>
                    {t.body && <p className="bg-muted/50 rounded-md px-2.5 py-1.5 text-sm whitespace-pre-line break-words">{t.body}</p>}
                    <p className="text-muted-foreground text-xs">{dateTime.format(new Date(t.at))}</p>
                  </li>
                ))}
              </ol>
              <NoteForm action={bind(addNote)} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5">
          {inquiry.stage === 'enrolled' && inquiry.client_id && (
            <Card className="gap-3">
              <CardHeader><CardTitle>Enrolled</CardTitle><CardDescription>{inquiry.student_name} is a client now.</CardDescription></CardHeader>
              <CardContent><Link href={`/app/clients/${inquiry.client_id}`} className="text-primary text-sm font-medium hover:underline">Open the client</Link></CardContent>
            </Card>
          )}

          {inquiry.stage === 'lost' && (
            <Card className="gap-3">
              <CardHeader><CardTitle>Closed as lost</CardTitle><CardDescription>{inquiry.lost_reason}</CardDescription></CardHeader>
              {manager && <CardContent><StageButton action={bind(moveStage)} stage="matching">Reopen</StageButton></CardContent>}
            </Card>
          )}

          {manager && isOpenStage(inquiry.stage) && (
            <Card className="gap-4">
              <CardHeader><CardTitle>Stage</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <StageSelect action={bind(moveStage)} stage={inquiry.stage} label="Stage" />
                <div className="border-t pt-4"><ConvertForm action={bind(convertToClient)} studentName={inquiry.student_name} guardianName={self ? null : inquiry.contact_name} /></div>
                <details className="border-t pt-3">
                  <summary className="cursor-pointer text-sm font-medium">Mark as lost</summary>
                  <div className="mt-3"><LostForm action={bind(moveStage)} /></div>
                </details>
              </CardContent>
            </Card>
          )}

          {(firstCall || (manager && open)) && (
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>First call</CardTitle>
                {!firstCall && <CardDescription>{coachName ? `${coachName} meets the family.` : 'Choose a coach first, then book the call from their open times.'}</CardDescription>}
              </CardHeader>
              <CardContent className="grid gap-4">
                {firstCall && (
                  <div className="grid gap-1 text-sm">
                    <p className={cn('font-medium', firstCall.status === 'cancelled' && 'text-muted-foreground line-through')}>{callTime.format(new Date(firstCall.starts_at))}</p>
                    <p className="text-muted-foreground">
                      With {byMembership.get(firstCall.host_membership_id) ?? 'a former coach'}
                      {firstCall.status === 'cancelled' ? ' · Cancelled' : callHappened ? ' · Took place' : ''}
                    </p>
                    {callUpcoming && firstCall.location_detail && (
                      /^https?:\/\//.test(firstCall.location_detail)
                        ? <a href={firstCall.location_detail} target="_blank" rel="noreferrer" className="text-primary break-all hover:underline">{firstCall.location_detail}</a>
                        : <p className="break-words">{firstCall.location_detail}</p>
                    )}
                    {callUpcoming && <p className="text-muted-foreground text-xs">To cancel or see it on the calendar, open <Link href="/app/bookings" className="text-primary hover:underline">Bookings</Link>.</p>}
                  </div>
                )}
                {lastOutcome && (
                  <div className="bg-muted/40 grid gap-2 rounded-md border p-3 text-sm">
                    <p>Outcome: <span className="font-medium">{outcomeLabel(lastOutcome.data.outcome)}</span></p>
                    {manager && inquiry.stage === 'first_call' && lastOutcome.data.outcome === 'good_fit' && <StageButton action={bind(moveStage)} stage="offer" variant="default">Move to Offer</StageButton>}
                    {manager && open && lastOutcome.data.outcome === 'not_a_fit' && <StageButton action={bind(moveStage)} stage="matching" rematch>Find another coach</StageButton>}
                    {manager && open && lastOutcome.data.outcome === 'no_show' && <p className="text-muted-foreground text-xs">Book another call below, or mark the inquiry as lost.</p>}
                  </div>
                )}
                {canRecord && firstCall?.status === 'confirmed' && !callUpcoming && !lastOutcome && <OutcomeForm action={bind(saveFirstCallOutcome)} />}
                {canRecord && callUpcoming && <p className="text-muted-foreground text-xs">After the call, come back here to record how it went.</p>}
                {manager && open && !callUpcoming && coachName && (
                  <div className={cn(firstCall && 'border-t pt-4')}>
                    {firstCall && <p className="mb-3 text-sm font-medium">Book another call</p>}
                    <FirstCallForm action={bind(bookFirstCall)} coachName={coachName} timezone={business.timezone} today={today} zoomAvailable={zoomAvailable} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {manager && open && (
            <Card className="gap-4">
              <CardHeader><CardTitle>People</CardTitle><CardDescription>Who handles this inquiry, and the coach proposed for the family.</CardDescription></CardHeader>
              <CardContent className="grid gap-4">
                <AssignForm key={`${inquiry.owner_membership_id}:${inquiry.coach_membership_id}`} action={bind(assignStaff)} ownerId={inquiry.owner_membership_id} coachId={inquiry.coach_membership_id}
                  owners={team.filter((m) => m.role !== 'coach').map((m) => ({ id: m.id, name: m.name }))} coaches={team.filter((m) => m.coaches).map((m) => ({ id: m.id, name: m.name }))} />
                {suggestions.length > 0 && (
                  <div className="grid gap-2 border-t pt-4">
                    <p className="text-sm font-medium">Suggested coaches</p>
                    <ul className="grid gap-2">
                      {suggestions.map((s) => (
                        <li key={s.coachId} className="flex items-start justify-between gap-3 rounded-md border p-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{s.name}{s.coachId === inquiry.coach_membership_id && <span className="text-muted-foreground font-normal"> · proposed</span>}</p>
                            <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">{s.reasons.map((r) => <li key={r.label} className={reasonTone[r.tone]}>{r.label}</li>)}</ul>
                          </div>
                          {s.coachId !== inquiry.coach_membership_id && <ProposeButton action={bind(assignStaff)} coachId={s.coachId} />}
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground text-xs">Based on subjects, free time over the next two weeks, and how many clients each coach has. You choose.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {manager && open && (
            <Card className="gap-4">
              <CardHeader><CardTitle>Next step</CardTitle><CardDescription>Shows on the board, and in the attention queue once it’s overdue.</CardDescription></CardHeader>
              <CardContent><NextActionForm key={`${inquiry.next_action}:${inquiry.next_action_due}`} action={bind(saveNextAction)} nextAction={inquiry.next_action} nextActionDue={inquiry.next_action_due} /></CardContent>
            </Card>
          )}

          {!manager && (
            <Card className="gap-3">
              <CardHeader><CardTitle>Your part</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground text-sm">You’re the proposed coach for this family. An owner or administrator books the first call; afterwards, record how it went and add any notes for the team.</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
