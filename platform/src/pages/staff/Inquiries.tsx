import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { format } from 'date-fns'
import { ExternalLink, Send, UserPlus, Check, Globe, Copy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar } from '@/components/ui/avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageHeader, Empty, KV, Field } from '@/components/page'
import { StageBadge } from '@/components/status'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { canManageInquiries, canSeePricing } from '@/lib/permissions'
import { nextDays, slotsForDay } from '@/lib/booking'
import { relative, money, dateTime } from '@/lib/format'
import { run } from '@/components/run'
import type { Inquiry, OfferOption, Staff } from '@/lib/types'
import { cn } from '@/lib/utils'

const STEPS: { key: string; label: string; stages: Inquiry['stage'][] }[] = [
  { key: 'in', label: 'Inquiry', stages: ['new'] },
  { key: 'match', label: 'Match', stages: ['matching'] },
  { key: 'fit', label: 'Fit call', stages: ['consult_scheduled'] },
  { key: 'offer', label: 'Offer', stages: ['consult_done', 'offer_sent'] },
  { key: 'enrolled', label: 'Enrolled', stages: ['enrolled'] },
]

function Stepper({ stage }: { stage: Inquiry['stage'] }) {
  const idx = STEPS.findIndex((s) => s.stages.includes(stage))
  return (
    <ol className="flex items-center gap-1.5 text-xs">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5', i < idx && 'bg-muted text-muted-foreground', i === idx && 'border-primary bg-accent text-accent-foreground font-medium', i > idx && 'text-muted-foreground')}>
            {i < idx && <Check className="size-3" />} {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="bg-border h-px w-2" />}
        </li>
      ))}
    </ol>
  )
}

export default function Inquiries() {
  const db = useDB()
  const me = useStaffViewer()!
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = React.useState<'open' | 'closed'>('open')
  const openId = params.get('open')
  const list = db.inquiries
    .filter((i) => (me.role !== 'coach' || i.matchedCoachId === me.id) && (tab === 'open' ? !['enrolled', 'declined'].includes(i.stage) : ['enrolled', 'declined'].includes(i.stage)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const current = db.inquiries.find((i) => i.id === openId)

  return (
    <>
      <PageHeader
        title="Inquiries"
        description={me.role === 'coach' ? 'Families matched to you for a fit call.' : `Every inquiry has one responsible person and a next step. Workflow: ${db.business.policies.workflow === 'team' ? 'admin review → coach match → fit call → admin offer' : 'direct consultation'}.`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to={`/b/${db.business.slug}`}><Globe /> Public inquiry page</Link>
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'closed')} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Enrolled and closed</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="py-0">
        {list.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Student</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="hidden sm:table-cell">Responsible</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="pr-5 text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((i) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => setParams({ open: i.id })}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={i.studentName} className="size-7 text-[10px]" />
                      <div>
                        <div className="font-medium">{i.studentName}</div>
                        <div className="text-muted-foreground text-xs">{i.grade}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{i.independent ? 'Student (independent)' : i.guardianName}</TableCell>
                  <TableCell><StageBadge stage={i.stage} /></TableCell>
                  <TableCell className="hidden sm:table-cell">{db.staff.find((s) => s.id === i.responsibleId)?.name}</TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">{i.source}</TableCell>
                  <TableCell className="text-muted-foreground pr-5 text-right text-xs">{relative(i.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6"><Empty title={tab === 'open' ? 'No open inquiries' : 'Nothing closed yet'}>Share your public inquiry page to receive new families.</Empty></div>
        )}
      </Card>

      <Sheet open={!!current} onOpenChange={(o) => !o && setParams({})}>
        <SheetContent className="sm:max-w-xl">{current && <InquiryDetail inq={current} me={me} />}</SheetContent>
      </Sheet>
    </>
  )
}

function InquiryDetail({ inq, me }: { inq: Inquiry; me: Staff }) {
  const db = useDB()
  const coaches = db.staff.filter((s) => s.coaches && s.status === 'active')
  const manage = canManageInquiries(me)
  const isCoach = inq.matchedCoachId === me.id
  const consult = db.appointments.find((a) => a.id === inq.consultApptId)
  const offer = db.offers.find((o) => o.id === inq.offerId)

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-3">
          <Avatar name={inq.studentName} className="size-10" />
          <div>
            <SheetTitle>{inq.studentName}</SheetTitle>
            <SheetDescription>{inq.grade} · {inq.school}</SheetDescription>
          </div>
        </div>
        <div className="pt-3"><Stepper stage={inq.stage} /></div>
      </SheetHeader>
      <div className="grid gap-6 p-5">
        <KV
          items={[
            ['Contact', inq.independent ? `${inq.studentName} (independent student)` : `${inq.guardianName} · ${inq.guardianEmail}`],
            ['Availability', inq.availability],
            ['Source', inq.source],
            ['Responsible', db.staff.find((s) => s.id === inq.responsibleId)?.name],
            ['Matched coach', inq.matchedCoachId ? db.staff.find((s) => s.id === inq.matchedCoachId)?.name : '—'],
          ]}
        />
        <div>
          <div className="mb-1 text-sm font-medium">What they’re looking for</div>
          <p className="text-muted-foreground text-sm">{inq.goals}</p>
        </div>
        {inq.answers && inq.answers.length > 0 && (
          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">Booking questionnaire · {db.eventTypes.find((e) => e.id === inq.eventTypeId)?.name}</div>
            <dl className="grid gap-2 text-sm">
              {inq.answers.map((x) => <div key={x.questionId}><dt className="text-muted-foreground text-xs">{x.label}</dt><dd>{x.value}</dd></div>)}
            </dl>
          </div>
        )}
        {inq.handoffNote && (
          <div className="bg-muted/60 rounded-md p-3 text-sm">
            <div className="text-muted-foreground mb-0.5 text-xs">Handoff note</div>
            {inq.handoffNote}
          </div>
        )}
        {inq.fitNotes && (
          <div className="bg-muted/60 rounded-md p-3 text-sm">
            <div className="text-muted-foreground mb-0.5 text-xs">Fit notes (shared with staff; separate from private session notes)</div>
            {inq.fitNotes}
          </div>
        )}
        <Separator />

        {(inq.stage === 'new' || inq.stage === 'matching') && manage && <MatchStep inq={inq} me={me} coaches={coaches} />}
        {(inq.stage === 'new' || inq.stage === 'matching' || inq.stage === 'waiting') && inq.matchedCoachId && (manage || isCoach) && <ConsultStep inq={inq} me={me} />}

        {inq.stage === 'consult_scheduled' && consult && (
          <div className="grid gap-4">
            <Alert variant="info">
              <AlertTitle>Fit call {dateTime(consult.start)}</AlertTitle>
              <AlertDescription>
                {consult.meeting.url ? <a href={consult.meeting.url} className="text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">Zoom link ready</a> : 'Meeting link pending'} · free, no credits used
              </AlertDescription>
            </Alert>
            {(isCoach || me.role === 'owner') && <OutcomeStep inq={inq} me={me} />}
            {!isCoach && me.role !== 'owner' && <p className="text-muted-foreground text-sm">Waiting for {db.staff.find((s) => s.id === inq.matchedCoachId)?.name} to report the outcome.</p>}
          </div>
        )}

        {inq.stage === 'consult_done' && (canSeePricing(me) ? <OfferBuilder inq={inq} me={me} /> : <p className="text-muted-foreground text-sm">An administrator will discuss pricing and send the offer. You’ll get a task when the family enrolls.</p>)}

        {inq.stage === 'offer_sent' && offer && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Offer v{offer.version} · {offer.status === 'sent' ? 'Waiting for the family' : offer.status === 'accepted' ? 'Option chosen, not yet signed' : offer.status === 'signed' ? 'Signed — awaiting payment' : offer.status}</div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/offer/${offer.token}`}><ExternalLink /> Open guest link</Link>
              </Button>
            </div>
            {canSeePricing(me) && (
              <ul className="grid gap-2 text-sm">
                {offer.options.map((o, i) => (
                  <li key={i} className={cn('flex justify-between rounded-md border px-3 py-2', offer.selected === i && 'border-primary bg-accent/50')}>
                    <span>{o.name}{o.kind === 'fixed' && o.installments > 1 ? ` · ${o.installments} installments` : o.kind === 'monthly' ? ' · monthly' : ' · paid in full'}</span>
                    <span className="tabular-nums">{money(o.priceCents)}{o.kind === 'monthly' ? '/mo' : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Copy className="size-3.5" /> Guest link: <code className="bg-muted rounded px-1">/offer/{offer.token}</code> · expires {format(new Date(offer.expiresAt), 'MMM d')}
            </div>
            {canSeePricing(me) && offer.status === 'sent' && <OfferBuilder inq={inq} me={me} revise />}
          </div>
        )}

        {inq.stage === 'enrolled' && inq.studentId && (
          <Alert variant="success">
            <Check />
            <AlertTitle>Enrolled</AlertTitle>
            <AlertDescription>
              <Link to={`/app/clients/${inq.studentId}`} className="text-primary hover:underline">Open {inq.studentName}’s client record</Link>
            </AlertDescription>
          </Alert>
        )}

        {manage && !['enrolled', 'declined'].includes(inq.stage) && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => run(actions.setInquiryStage(inq.id, 'waiting', me.id), 'Marked as waiting')}>Mark waiting</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => run(actions.setInquiryStage(inq.id, 'declined', me.id), 'Inquiry closed')}>Close inquiry</Button>
          </div>
        )}
        {inq.stage === 'declined' && manage && (
          <Button variant="outline" size="sm" onClick={() => run(actions.setInquiryStage(inq.id, 'new', me.id), 'Inquiry reopened')}>Reopen without duplicating history</Button>
        )}
      </div>
    </>
  )
}

function MatchStep({ inq, me, coaches }: { inq: Inquiry; me: Staff; coaches: Staff[] }) {
  const [coachId, setCoachId] = React.useState(inq.matchedCoachId ?? '')
  const [note, setNote] = React.useState(inq.handoffNote ?? '')
  return (
    <div className="grid gap-3">
      <div className="text-sm font-semibold">Match a coach</div>
      <Select value={coachId} onValueChange={setCoachId}>
        <SelectTrigger><SelectValue placeholder="Choose a coach" /></SelectTrigger>
        <SelectContent>
          {coaches.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name} · {c.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea placeholder="Handoff note for the coach (no private notes)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button className="justify-self-start" size="sm" disabled={!coachId} onClick={() => run(actions.matchCoach(inq.id, coachId, note, me.id))}>
        <UserPlus /> {inq.matchedCoachId ? 'Update match' : 'Match and hand off'}
      </Button>
    </div>
  )
}

function ConsultStep({ inq, me }: { inq: Inquiry; me: Staff }) {
  const db = useDB()
  const days = nextDays(8).slice(1)
  const [day, setDay] = React.useState(days[0])
  const slots = slotsForDay(db, inq.matchedCoachId!, day, 20, new Date(), { ignoreNotice: true })
  return (
    <div className="grid gap-3">
      <div className="text-sm font-semibold">Book a free fit call with {db.staff.find((s) => s.id === inq.matchedCoachId)?.name.split(' ')[0]}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => (
          <Button key={d.toISOString()} size="sm" variant={d.getTime() === day.getTime() ? 'default' : 'outline'} onClick={() => setDay(d)}>
            {format(d, 'EEE d')}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {slots.slice(0, 12).map((s) => (
          <Button key={s.toISOString()} size="sm" variant="outline" onClick={() => run(actions.bookConsult(inq.id, inq.matchedCoachId!, s, me.name), 'Fit call booked. Family notified.')}>
            {format(s, 'h:mm a')}
          </Button>
        ))}
        {!slots.length && <span className="text-muted-foreground col-span-4 text-sm">No open times this day.</span>}
      </div>
    </div>
  )
}

function OutcomeStep({ inq, me }: { inq: Inquiry; me: Staff }) {
  const [outcome, setOutcome] = React.useState<'fit' | 'follow_up' | 'not_fit'>('fit')
  const [notes, setNotes] = React.useState('')
  return (
    <div className="grid gap-3">
      <div className="text-sm font-semibold">How did the fit call go?</div>
      <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
        {[
          ['fit', 'Good fit — ready for an offer'],
          ['follow_up', 'Family needs time — follow up later'],
          ['not_fit', 'Not a fit'],
        ].map(([v, l]) => (
          <Label key={v} className="font-normal"><RadioGroupItem value={v} /> {l}</Label>
        ))}
      </RadioGroup>
      <Textarea placeholder="Fit notes for the team (recommendation, scheduling preferences)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button size="sm" className="justify-self-start" onClick={() => run(actions.recordFit(inq.id, outcome, notes, me.id), 'Outcome saved. The next person has a task.')}>Save outcome</Button>
    </div>
  )
}

function OfferBuilder({ inq, me, revise }: { inq: Inquiry; me: Staff; revise?: boolean }) {
  const db = useDB()
  const choices: OfferOption[] = db.offerings
    .filter((o) => o.active)
    .flatMap((o) =>
      o.installmentOptions.map((n) => ({ offeringId: o.id, name: o.name, kind: o.kind, credits: o.credits, priceCents: o.priceCents, installments: n, termWeeks: o.termWeeks, sessionTypeIds: o.sessionTypeIds })),
    )
  const [picked, setPicked] = React.useState<number[]>(revise ? [] : [0, 1])
  const [show, setShow] = React.useState(!revise)
  if (!show) return <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setShow(true)}>Send a revised offer</Button>
  return (
    <div className="grid gap-3">
      <div className="text-sm font-semibold">{revise ? 'Revised offer (replaces the current version)' : 'Build an offer'}</div>
      <div className="grid gap-2">
        {choices.map((c, i) => (
          <Label key={i} className="has-[[data-state=checked]]:border-primary flex items-center gap-3 rounded-md border p-3 font-normal">
            <Checkbox checked={picked.includes(i)} onCheckedChange={(v) => setPicked((p) => (v ? [...p, i] : p.filter((x) => x !== i)))} />
            <span className="flex-1">
              <span className="block font-medium">{c.name}</span>
              <span className="text-muted-foreground text-xs">
                {c.credits} credits{c.kind === 'monthly' ? ' per month' : ` over ${c.termWeeks} weeks`} · {c.kind === 'monthly' ? 'billed monthly' : c.installments === 1 ? 'paid in full' : `${c.installments} installments of ${money(Math.round(c.priceCents / c.installments))}`}
              </span>
            </span>
            <span className="tabular-nums">{money(c.priceCents)}{c.kind === 'monthly' ? '/mo' : ''}</span>
          </Label>
        ))}
      </div>
      <Field label="Policy snapshot" hint="Frozen into the agreement when the family accepts.">
        <div className="text-muted-foreground text-sm">Cancel {db.business.policies.cancelNoticeHours}h ahead · late changes {db.business.policies.lateCancelOutcome === 'forfeit' ? 'use the credit' : 'keep the credit'} · makeups up to {db.business.policies.makeupWindowDays} days after the end date</div>
      </Field>
      <Button size="sm" className="justify-self-start" disabled={!picked.length} onClick={() => run(actions.sendOffer(inq.id, picked.map((i) => choices[i]), me.id), `Offer emailed to ${inq.independent ? inq.studentName : inq.guardianName}`)}>
        <Send /> {revise ? 'Send revised offer' : 'Send offer'}
      </Button>
    </div>
  )
}
