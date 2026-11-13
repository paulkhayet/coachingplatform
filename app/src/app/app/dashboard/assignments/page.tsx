import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AssignedPackageTerms, InquiryStage } from '@/db/schema'
import { rankCoaches, type CoachMatch } from '@/lib/insights/matching'
import { loadCoachLoads } from '@/lib/insights/server'
import { OPEN_STAGES, STAGE_LABELS } from '@/lib/intake/shared'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { requireDashboard } from '../guard'
import { assignStaff } from '../intake/actions'
import { ProposeButton } from '../intake/forms'
import { assignClientCoach, moveAllClients, saveCoachProfile } from './actions'
import { AssignCoachButton, CoachProfileForm, MoveAllForm, ReassignSelect } from './forms'

export const metadata: Metadata = { title: 'Assignments' }

type ClientRow = { id: string; name: string; coach_membership_id: string | null }
type InquiryRow = { id: string; student_name: string; stage: InquiryStage; subjects: string[]; coach_membership_id: string | null; client_id: string | null }
const reasonTone = { good: 'text-success', warn: 'text-warning', neutral: 'text-muted-foreground' }

function Suggestions({ matches, children }: { matches: CoachMatch[]; children: (match: CoachMatch) => React.ReactNode }) {
  if (!matches.length) return <p className="text-muted-foreground text-xs">Nobody coaches for this business yet.</p>
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {matches.map((m) => (
        <li key={m.coachId} className="grid content-between gap-2 rounded-md border p-2.5">
          <div>
            <p className="text-sm font-medium">{m.name}</p>
            <ul className="mt-1 grid gap-0.5 text-xs">{m.reasons.map((r) => <li key={r.label} className={reasonTone[r.tone]}>{r.label}</li>)}</ul>
          </div>
          <div className="justify-self-start">{children(m)}</div>
        </li>
      ))}
    </ul>
  )
}

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ coach?: string }> }) {
  const { business } = await requireDashboard('manager')
  const supabase = await createClient()
  const [clients, inquiries, packages, loads, { coach: coachParam }] = await Promise.all([
    supabase.from('coaching_clients').select('id, name, coach_membership_id').eq('business_id', business.id).order('name').returns<ClientRow[]>(),
    supabase.from('inquiries').select('id, student_name, stage, subjects, coach_membership_id, client_id').eq('business_id', business.id)
      .or(`stage.in.(${OPEN_STAGES.join(',')}),client_id.not.is.null`).returns<InquiryRow[]>(),
    supabase.from('client_packages').select('client_id, terms, created_at').eq('business_id', business.id).order('created_at').returns<{ client_id: string; terms: AssignedPackageTerms }[]>(),
    loadCoachLoads(business.id),
    searchParams,
  ])
  const allClients = clients.data ?? []
  const coachChoices = loads.map((c) => ({ id: c.id, name: c.name }))
  const coachNames = new Map(coachChoices.map((c) => [c.id, c.name]))
  // What we know about an unassigned client: the subjects from their inquiry, and who their latest package allows.
  const subjectsByClient = new Map((inquiries.data ?? []).filter((i) => i.client_id).map((i) => [i.client_id!, i.subjects]))
  const eligibleByClient = new Map((packages.data ?? []).map((p) => [p.client_id, p.terms.eligibleCoachIds]))
  const waitingInquiries = (inquiries.data ?? []).filter((i) => !i.coach_membership_id && !i.client_id)
  const waitingClients = allClients.filter((c) => !c.coach_membership_id || !coachNames.has(c.coach_membership_id))
  const waiting = waitingInquiries.length + waitingClients.length

  const selected = loads.find((c) => c.id === coachParam) ?? null
  const shown = selected ? allClients.filter((c) => c.coach_membership_id === selected.id) : allClients.filter((c) => c.coach_membership_id && coachNames.has(c.coach_membership_id))
  const filter = (active: boolean) => cn('rounded-md px-2.5 py-1 text-sm', active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground')

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Needs a coach {waiting > 0 && <Badge variant="secondary">{waiting}</Badge>}</CardTitle>
          <CardDescription>Inquiries with no proposed coach, and clients without one. Suggestions weigh subjects, free time in the next two weeks, and each coach’s load. You choose.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {waiting === 0 && <p className="text-muted-foreground text-sm">Everyone has a coach.</p>}
          {waitingInquiries.map((i) => (
            <div key={i.id} className="grid gap-2.5 border-b pb-4 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/app/dashboard/intake/${i.id}`} className="font-medium hover:underline">{i.student_name}</Link>
                <Badge variant="outline">Inquiry · {STAGE_LABELS[i.stage]}</Badge>
                {i.subjects.map((s) => <Badge key={s} variant="accent">{s}</Badge>)}
              </div>
              <Suggestions matches={rankCoaches({ subjects: i.subjects }, loads).slice(0, 3)}>
                {(m) => <ProposeButton action={assignStaff.bind(null, business.id, i.id)} coachId={m.coachId} />}
              </Suggestions>
            </div>
          ))}
          {waitingClients.map((c) => {
            const subjects = subjectsByClient.get(c.id) ?? []
            return (
              <div key={c.id} className="grid gap-2.5 border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/app/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                  <Badge variant="outline">Client{c.coach_membership_id ? ' · coach left' : ''}</Badge>
                  {subjects.map((s) => <Badge key={s} variant="accent">{s}</Badge>)}
                </div>
                <Suggestions matches={rankCoaches({ subjects, eligibleCoachIds: eligibleByClient.get(c.id) ?? null }, loads).slice(0, 3)}>
                  {(m) => <AssignCoachButton action={assignClientCoach.bind(null, business.id, c.id)} coachId={m.coachId} />}
                </Suggestions>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coaches</CardTitle>
          <CardDescription>What each coach teaches and how many clients they take. Coaches can edit their own subjects on the Team page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-0 divide-y">
          {loads.length === 0 && <p className="text-muted-foreground text-sm">Nobody coaches for {business.name} yet. Invite coaches from the Team page.</p>}
          {loads.map((c) => (
            <details key={c.id} className="group py-3 first:pt-0 last:pb-0">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                  {c.specialties.length ? c.specialties.slice(0, 5).map((s) => <Badge key={s} variant="accent">{s}</Badge>) : <span className="text-warning">No subjects yet</span>}
                  {c.specialties.length > 5 && <span>+{c.specialties.length - 5}</span>}
                  <span className="ml-1 tabular-nums">{c.activeClients}{c.maxClients !== null ? ` of ${c.maxClients}` : ''} {c.activeClients === 1 && c.maxClients === null ? 'client' : 'clients'}</span>
                </span>
              </summary>
              <div className="mt-3 max-w-xl"><CoachProfileForm action={saveCoachProfile.bind(null, business.id, c.id)} specialties={c.specialties} maxClients={c.maxClients} withLimit /></div>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clients by coach</CardTitle>
          <CardDescription>Moving a client changes who they’re assigned to. Sessions already booked stay with the coach hosting them; move those from each session’s page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-1">
            <Link href="/app/dashboard/assignments" className={filter(!selected)}>All</Link>
            {loads.map((c) => <Link key={c.id} href={`/app/dashboard/assignments?coach=${c.id}`} className={filter(selected?.id === c.id)}>{c.name} <span className="tabular-nums">({c.activeClients})</span></Link>)}
          </div>
          {shown.length === 0 ? <p className="text-muted-foreground text-sm">{selected ? `${selected.name} has no clients.` : 'No clients are assigned yet.'}</p> : (
            <ul className="divide-y rounded-md border">
              {shown.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/app/clients/${c.id}`} className="text-sm font-medium hover:underline">{c.name}</Link>
                    {!selected && <p className="text-muted-foreground text-xs">{coachNames.get(c.coach_membership_id!)}</p>}
                  </div>
                  <ReassignSelect key={c.coach_membership_id} action={assignClientCoach.bind(null, business.id, c.id)} coachId={c.coach_membership_id} coaches={coachChoices} clientName={c.name} />
                </li>
              ))}
            </ul>
          )}
          {selected && shown.length > 0 && (
            <details className="border-t pt-3">
              <summary className="cursor-pointer text-sm font-medium">Move all of {selected.name}’s clients</summary>
              <div className="mt-3"><MoveAllForm action={moveAllClients.bind(null, business.id, selected.id)} fromName={selected.name} count={shown.length} coaches={coachChoices.filter((c) => c.id !== selected.id)} /></div>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
