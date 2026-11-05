import * as React from 'react'
import { useSearchParams } from 'react-router'
import { CalendarDays, Video, CreditCard, FileSignature, MessageSquare, Sparkles, CircleCheck, CircleAlert, Plus, Trash2, Lock } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/page'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { canEditPolicies } from '@/lib/permissions'
import { planById } from '@/lib/plans'
import { relative } from '@/lib/format'
import { run } from '@/components/run'
import type { Availability, IntegrationKey, Policies, Staff } from '@/lib/types'

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <div className="text-sm font-medium">{title}</div>
        {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function NumSelect({ value, options, onChange, suffix, disabled }: { value: number; options: number[]; onChange: (n: number) => void; suffix: string; disabled?: boolean }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={String(o)}>{o} {suffix}</SelectItem>)}</SelectContent>
    </Select>
  )
}

export default function Settings() {
  const me = useStaffViewer()!
  const [params, setParams] = useSearchParams()
  const isCoach = me.role === 'coach'
  const tab = params.get('tab') ?? (isCoach ? 'availability' : 'booking')
  return (
    <>
      <PageHeader title={isCoach ? 'My settings' : 'Settings'} description={isCoach ? 'Your availability and calendar connection. Business policies are set by the owner.' : canEditPolicies(me) ? 'Business defaults. Accepted agreements keep the terms they were signed under.' : 'Business policies are owner-governed. You can view them here.'} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          {!isCoach && <TabsTrigger value="booking">Booking and payment</TabsTrigger>}
          {!isCoach && <TabsTrigger value="cancellation">Cancellations</TabsTrigger>}
          {!isCoach && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
          {!isCoach && <TabsTrigger value="followups">Follow-ups</TabsTrigger>}
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          {me.coaches && <TabsTrigger value="availability">Availability</TabsTrigger>}
          {!isCoach && <TabsTrigger value="activity">Activity log</TabsTrigger>}
        </TabsList>
        {!isCoach && <TabsContent value="booking"><PolicyBooking me={me} /></TabsContent>}
        {!isCoach && <TabsContent value="cancellation"><PolicyCancel me={me} /></TabsContent>}
        {!isCoach && <TabsContent value="notifications"><PolicyNotify me={me} /></TabsContent>}
        {!isCoach && <TabsContent value="followups"><PolicyFollowUps me={me} /></TabsContent>}
        <TabsContent value="integrations"><Integrations me={me} /></TabsContent>
        {me.coaches && <TabsContent value="availability"><AvailabilityEditor me={me} /></TabsContent>}
        {!isCoach && <TabsContent value="activity"><Activity /></TabsContent>}
      </Tabs>
    </>
  )
}

function usePolicy(me: Staff) {
  const db = useDB()
  const p = db.business.policies
  const edit = canEditPolicies(me)
  const set = (patch: Partial<Policies>) => run(actions.updatePolicies(patch, me.id), 'Saved — applies to new agreements and bookings')
  return { p, edit, set }
}

function PolicyBooking({ me }: { me: Staff }) {
  const { p, edit, set } = usePolicy(me)
  return (
    <Card className="py-2">
      <CardContent>
        {!edit && <ReadOnly />}
        <Row title="Booking against payments" hint="Choose whether families can reserve future sessions before those sessions are paid for. Delivery always requires paid coverage.">
          <RadioGroup value={p.bookingMode} onValueChange={(v) => set({ bookingMode: v as Policies['bookingMode'] })} disabled={!edit}>
            <Label className="font-normal"><RadioGroupItem value="funded_only" /> Funded credits only</Label>
            <Label className="font-normal"><RadioGroupItem value="advance" /> Allow advance reservations</Label>
          </RadioGroup>
        </Row>
        {p.bookingMode === 'advance' && (
          <>
            <Row title="Release unpaid reservations automatically" hint="Each unfunded occurrence is evaluated at the cutoff. Families and staff are notified; a later payment offers rebooking.">
              <Switch checked={p.autoCancelUnpaid} onCheckedChange={(v) => set({ autoCancelUnpaid: v })} disabled={!edit} />
            </Row>
            <Row title="Payment cutoff" hint="How long before an unfunded session it is released or flagged.">
              <NumSelect value={p.unpaidCutoffHours} options={[24, 48, 72, 96]} suffix="hours before" onChange={(n) => set({ unpaidCutoffHours: n })} disabled={!edit} />
            </Row>
          </>
        )}
        <Row title="Minimum notice for family bookings"><NumSelect value={p.minNoticeHours} options={[2, 6, 12, 24, 48]} suffix="hours" onChange={(n) => set({ minNoticeHours: n })} disabled={!edit} /></Row>
        <Row title="Booking window" hint="How far ahead families can book."><NumSelect value={p.bookingWindowDays} options={[14, 30, 60, 90]} suffix="days" onChange={(n) => set({ bookingWindowDays: n })} disabled={!edit} /></Row>
        <Row title="Buffer between sessions"><NumSelect value={p.bufferMinutes} options={[0, 5, 10, 15, 30]} suffix="minutes" onChange={(n) => set({ bufferMinutes: n })} disabled={!edit} /></Row>
        <Row title="Intake workflow" hint="Guided templates — not a custom workflow builder.">
          <RadioGroup value={p.workflow} onValueChange={(v) => set({ workflow: v as Policies['workflow'] })} disabled={!edit}>
            <Label className="font-normal"><RadioGroupItem value="direct" /> Direct consultation</Label>
            <Label className="font-normal"><RadioGroupItem value="team" /> Admin review → coach match → fit call → admin offer</Label>
          </RadioGroup>
        </Row>
        <Row title="Pool booking access window" hint="How long a pool coach keeps access after their booked sessions."><NumSelect value={p.poolAccessDays} options={[3, 7, 14, 30]} suffix="days" onChange={(n) => set({ poolAccessDays: n })} disabled={!edit} /></Row>
      </CardContent>
    </Card>
  )
}

function PolicyCancel({ me }: { me: Staff }) {
  const { p, edit, set } = usePolicy(me)
  return (
    <Card className="py-2">
      <CardContent>
        {!edit && <ReadOnly />}
        <Alert variant="info" className="my-3"><AlertDescription>There’s no universal 24-hour rule. Your choices are snapshotted into each agreement and appointment, and shown to families before they cancel.</AlertDescription></Alert>
        <Row title="Cancellation notice" hint="Cancelling with at least this much notice keeps the credit and makes it eligible for a makeup."><NumSelect value={p.cancelNoticeHours} options={[12, 24, 48, 72]} suffix="hours" onChange={(n) => set({ cancelNoticeHours: n })} disabled={!edit} /></Row>
        <Row title="Late cancellation">
          <Select value={p.lateCancelOutcome} onValueChange={(v) => set({ lateCancelOutcome: v as Policies['lateCancelOutcome'] })} disabled={!edit}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="forfeit">Uses the credit</SelectItem><SelectItem value="preserve">Keeps the credit</SelectItem></SelectContent>
          </Select>
        </Row>
        <Row title="No-show">
          <Select value={p.noShowOutcome} onValueChange={(v) => set({ noShowOutcome: v as Policies['noShowOutcome'] })} disabled={!edit}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="forfeit">Uses the credit</SelectItem><SelectItem value="preserve">Keeps the credit</SelectItem></SelectContent>
          </Select>
        </Row>
        <Row title="Makeup deadline" hint="Eligible makeups stay bookable after the program ends, until this deadline."><NumSelect value={p.makeupWindowDays} options={[14, 30, 60, 90]} suffix="days after end" onChange={(n) => set({ makeupWindowDays: n })} disabled={!edit} /></Row>
      </CardContent>
    </Card>
  )
}

function PolicyNotify({ me }: { me: Staff }) {
  const db = useDB()
  const { p, edit, set } = usePolicy(me)
  const plan = planById(db.business.plan)
  const toggleHour = (h: number) => set({ emailReminderHours: p.emailReminderHours.includes(h) ? p.emailReminderHours.filter((x) => x !== h) : [...p.emailReminderHours, h].sort((a, b) => b - a) })
  return (
    <div className="grid gap-6">
      <Card className="py-2">
        <CardContent>
          {!edit && <ReadOnly />}
          <Row title="Email reminders" hint="Sent to the student and guardians with booking rights.">
            <div className="flex gap-1.5">
              {[48, 24, 2, 1].map((h) => (
                <Button key={h} size="sm" variant={p.emailReminderHours.includes(h) ? 'default' : 'outline'} onClick={() => toggleHour(h)} disabled={!edit}>{h}h</Button>
              ))}
            </div>
          </Row>
          <Row title="SMS reminders" hint="Only for recipients who opted in. Business identity, time and a manage link — never notes, homework or amounts.">
            <Switch checked={p.smsEnabled} onCheckedChange={(v) => set({ smsEnabled: v })} disabled={!edit} />
          </Row>
          {p.smsEnabled && (
            <>
              <Row title="SMS timing"><NumSelect value={p.smsReminderHours} options={[1, 2, 3, 4]} suffix="hours before" onChange={(n) => set({ smsReminderHours: n })} disabled={!edit} /></Row>
              <Row title="Quiet hours" hint="Hold SMS outside 8 a.m.–8 p.m. in the recipient’s time zone. Email still goes out."><Switch checked={p.smsQuietHours} onCheckedChange={(v) => set({ smsQuietHours: v })} disabled={!edit} /></Row>
              <Row title="SMS this month" hint="At the allowance, SMS pauses and email continues. No silent overage charges.">
                <div className="w-48">
                  <Progress value={(db.business.usage.smsThisMonth / Math.max(1, plan.sms)) * 100} />
                  <div className="text-muted-foreground mt-1 text-xs">{db.business.usage.smsThisMonth} of {plan.sms} (candidate allowance)</div>
                </div>
              </Row>
            </>
          )}
        </CardContent>
      </Card>
      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Message log</CardTitle>
          <CardDescription>Accepted by the provider is not proof someone read it.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader><TableRow><TableHead className="pl-5">When</TableHead><TableHead>Channel</TableHead><TableHead>To</TableHead><TableHead className="hidden md:table-cell">Subject</TableHead><TableHead className="pr-5">State</TableHead></TableRow></TableHeader>
            <TableBody>
              {db.notifications.slice(0, 25).map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="text-muted-foreground pl-5 text-xs">{relative(n.at)}</TableCell>
                  <TableCell>{n.channel === 'email' ? 'Email' : 'SMS'}</TableCell>
                  <TableCell>{n.to}</TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-xs truncate md:table-cell">{n.subject}</TableCell>
                  <TableCell className="pr-5"><StatusBadge tone={n.status === 'delivered' || n.status === 'sent' ? 'success' : n.status === 'failed' ? 'danger' : 'neutral'}>{n.status}</StatusBadge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function PolicyFollowUps({ me }: { me: Staff }) {
  const { p, edit, set } = usePolicy(me)
  return (
    <Card className="py-2">
      <CardContent>
        {!edit && <ReadOnly />}
        <Row title="Sending mode" hint="Manual approval is the recommended default. Automatic sending holds anything with a missing source, uncertain permission, or failed check.">
          <RadioGroup value={p.followUpMode} onValueChange={(v) => set({ followUpMode: v as Policies['followUpMode'] })} disabled={!edit}>
            <Label className="font-normal"><RadioGroupItem value="manual" /> Coach reviews and publishes</Label>
            <Label className="font-normal"><RadioGroupItem value="automatic" /> Send automatically when eligible</Label>
          </RadioGroup>
        </Row>
        {p.followUpMode === 'automatic' && (
          <Row title="Automatic audiences">
            <div className="grid gap-2">
              <Label className="font-normal"><Switch checked={p.autoSendAudiences.student} onCheckedChange={(v) => set({ autoSendAudiences: { ...p.autoSendAudiences, student: v } })} disabled={!edit} /> Student version</Label>
              <Label className="font-normal"><Switch checked={p.autoSendAudiences.parent} onCheckedChange={(v) => set({ autoSendAudiences: { ...p.autoSendAudiences, parent: v } })} disabled={!edit} /> Parent version</Label>
            </div>
          </Row>
        )}
        <Row title="Private coach notes" hint="Always excluded from family-directed drafts.">
          <Badge variant="outline"><Lock className="size-3" /> Excluded</Badge>
        </Row>
        <Row title="Delivery" hint="Published in the portal with an email link. SMS never carries summaries.">
          <Badge variant="outline">Portal + email</Badge>
        </Row>
      </CardContent>
    </Card>
  )
}

const INTEGRATIONS: { key: IntegrationKey; name: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { key: 'google', name: 'Google Calendar', icon: CalendarDays, desc: 'Each coach connects one Google account. Busy times block availability; sessions are added to their calendar.' },
  { key: 'zoom', name: 'Zoom', icon: Video, desc: 'Creates a meeting link for every online session and imports authorized meeting summaries.' },
  { key: 'stripe', name: 'Stripe', icon: CreditCard, desc: 'Families pay for coaching through your Stripe account. schedulefa.st adds no transaction fee.' },
  { key: 'esign', name: 'E-signature', icon: FileSignature, desc: 'Families sign agreements in the guest enrollment flow.' },
  { key: 'sms', name: 'SMS reminders', icon: MessageSquare, desc: 'Opt-in appointment reminders.' },
  { key: 'ai', name: 'Follow-up drafting', icon: Sparkles, desc: 'Turns a permitted session source into audience-specific drafts.' },
]

function Integrations({ me }: { me: Staff }) {
  const db = useDB()
  const coaches = db.staff.filter((s) => s.coaches && s.status === 'active')
  const list = me.role === 'coach' ? INTEGRATIONS.filter((i) => i.key === 'google') : INTEGRATIONS
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((i) => {
        const st = db.business.integrations[i.key]
        const healthy = i.key === 'google' ? coaches.every((c) => c.googleConnected && c.calendarHealthy) : st.status === 'connected'
        return (
          <Card key={i.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><i.icon className="size-4" /> {i.name}</CardTitle>
              <CardDescription>{i.desc}</CardDescription>
              <CardAction>{healthy ? <StatusBadge tone="success">Connected</StatusBadge> : <StatusBadge tone="warning">Needs attention</StatusBadge>}</CardAction>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {i.key === 'google' ? (
                <ul className="grid gap-1.5">
                  {coaches.filter((c) => me.role !== 'coach' || c.id === me.id).map((c) => (
                    <li key={c.id} className="flex items-center justify-between">
                      <span>{c.name}</span>
                      {c.googleConnected && c.calendarHealthy ? <span className="flex items-center gap-1 text-xs"><CircleCheck className="text-success size-3.5" /> Synced</span> : <span className="text-warning flex items-center gap-1 text-xs"><CircleAlert className="size-3.5" /> {c.googleConnected ? 'Sync stale' : 'Not connected'}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground">{st.account}{st.note && <span className="block text-xs">{st.note}</span>}</div>
              )}
              <div className="flex gap-2">
                {i.key === 'google' && !healthy && <Button size="sm" onClick={() => run(actions.setIntegration('google', 'connected', me.id), 'Google Calendar reconnected; availability refreshed')}>Reconnect</Button>}
                {i.key !== 'google' && me.role === 'owner' && (st.status === 'connected' ? <Button size="sm" variant="outline" onClick={() => run(actions.setIntegration(i.key, 'disconnected', me.id), `${i.name} disconnected. New work that needs it will surface as issues.`)}>Disconnect</Button> : <Button size="sm" onClick={() => run(actions.setIntegration(i.key, 'connected', me.id), `${i.name} connected`)}>Connect</Button>)}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIMES = Array.from({ length: 29 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

function AvailabilityEditor({ me }: { me: Staff }) {
  const [rows, setRows] = React.useState<Availability[]>(me.availability)
  const save = (next: Availability[]) => {
    setRows(next)
    actions.setAvailability(me.id, next)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly availability</CardTitle>
        <CardDescription>Families and staff see open times inside these hours, minus Google Calendar busy times and existing sessions.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const day = rows.filter((r) => r.weekday === d)
          return (
            <div key={d} className="flex flex-wrap items-center gap-2 border-b py-2 last:border-0">
              <span className="w-28 text-sm font-medium">{DAYS[d]}</span>
              <div className="flex flex-1 flex-wrap gap-2">
                {day.length ? day.map((r) => {
                  const idx = rows.indexOf(r)
                  return (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Select value={r.start} onValueChange={(v) => save(rows.map((x, i) => (i === idx ? { ...x, start: v } : x)))}>
                        <SelectTrigger size="sm" className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="text-muted-foreground text-xs">to</span>
                      <Select value={r.end} onValueChange={(v) => save(rows.map((x, i) => (i === idx ? { ...x, end: v } : x)))}>
                        <SelectTrigger size="sm" className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon-sm" onClick={() => save(rows.filter((_, i) => i !== idx))} aria-label="Remove hours"><Trash2 /></Button>
                    </div>
                  )
                }) : <span className="text-muted-foreground text-sm">Unavailable</span>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => save([...rows, { weekday: d, start: '15:00', end: '19:00' }])}><Plus /> Add hours</Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function Activity() {
  const db = useDB()
  return (
    <Card className="py-0">
      <Table>
        <TableHeader><TableRow><TableHead className="pl-5">When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead className="pr-5">Detail</TableHead></TableRow></TableHeader>
        <TableBody>
          {db.audit.slice(0, 60).map((a) => (
            <TableRow key={a.id}>
              <TableCell className="text-muted-foreground pl-5 text-xs whitespace-nowrap">{relative(a.at)}</TableCell>
              <TableCell>{a.actor}</TableCell>
              <TableCell className="font-medium">{a.action}</TableCell>
              <TableCell className="text-muted-foreground pr-5">{a.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function ReadOnly() {
  return <div className="text-muted-foreground flex items-center gap-2 py-3 text-xs"><Lock className="size-3.5" /> Only the owner can change business policies.</div>
}
