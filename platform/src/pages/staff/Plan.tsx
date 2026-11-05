import * as React from 'react'
import { Check, CalendarClock, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/page'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { PLANS, planById, type Plan } from '@/lib/plans'
import { date, money } from '@/lib/format'
import { run } from '@/components/run'
import { cn } from '@/lib/utils'

export default function PlanPage() {
  const db = useDB()
  const me = useStaffViewer()!
  const current = planById(db.business.plan)
  const pending = db.business.pendingPlanChange
  const [target, setTarget] = React.useState<Plan | null>(null)
  const seatsUsed = db.staff.filter((s) => s.status === 'active' || s.status === 'invited').length
  const u = db.business.usage
  const meters = [
    { label: 'Staff seats', used: seatsUsed, cap: current.seats },
    { label: 'SMS reminders this month', used: u.smsThisMonth, cap: current.sms },
    { label: 'Follow-up drafts this month', used: u.aiDraftsThisMonth, cap: current.aiDrafts },
    { label: 'E-signatures this month', used: u.signaturesThisMonth, cap: current.signatures },
  ]

  return (
    <>
      <PageHeader title="Plan and billing" description="Plans differ by staff capacity. Parent and student portal access is always free, and there’s no fee on your coaching payments." />
      <Alert variant="warning" className="mb-6">
        <TriangleAlert />
        <AlertTitle>Candidate pricing</AlertTitle>
        <AlertDescription>Prices and allowances here are placeholders from the marketing site. Final entitlements are still open (Q-01).</AlertDescription>
      </Alert>

      {pending && (
        <Alert variant="info" className="mb-6">
          <CalendarClock />
          <AlertTitle>Switching to {planById(pending.to).name} on {date(pending.effective)}</AlertTitle>
          <AlertDescription>
            <p>Keeping {pending.keepStaffIds.map((id) => db.staff.find((s) => s.id === id)?.name).join(', ')} active. Everyone else becomes inactive; their records and authorship are preserved.</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => run(actions.cancelPlanChange(me.id), 'Scheduled change cancelled')}>Cancel change</Button>
              <Button size="sm" onClick={() => run(actions.applyPlanChange(me.id))}>Simulate renewal date</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{current.name} plan</CardTitle>
            <CardDescription>{current.monthlyCents ? `${money(current.monthlyCents)} per month` : 'Free'} · renews {date(new Date(Date.now() + 12 * 86400000).toISOString())}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {meters.map((m) => (
              <div key={m.label}>
                <div className="mb-1 flex justify-between text-sm"><span>{m.label}</span><span className="text-muted-foreground tabular-nums">{m.used} / {m.cap}</span></div>
                <Progress value={(m.used / Math.max(1, m.cap)) * 100} />
              </div>
            ))}
            <p className="text-muted-foreground text-xs">Reaching an allowance pauses that optional action and tells you why. It never silently charges extra, cancels coaching, or invalidates a signed agreement.</p>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((p) => (
            <Card key={p.id} className={cn(p.id === current.id && 'border-primary ring-primary/20 ring-2')}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">{p.name} {p.id === current.id && <Badge variant="accent">Current</Badge>}</CardTitle>
                <CardDescription>{p.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <div className="text-2xl font-semibold">{p.monthlyCents ? money(p.monthlyCents) : 'Free'}<span className="text-muted-foreground text-sm font-normal">{p.monthlyCents ? ' / month' : ''}</span></div>
                <div className="flex items-center gap-2"><Check className="text-success size-4" /> {p.seats} staff seat{p.seats > 1 ? 's' : ''}</div>
                <div className="flex items-center gap-2"><Check className="text-success size-4" /> {p.sms ? `${p.sms} SMS / month` : 'Email reminders only'}</div>
                <div className="flex items-center gap-2"><Check className="text-success size-4" /> {p.aiDrafts} follow-up drafts / month</div>
              </CardContent>
              <CardFooter>
                {p.id !== current.id && (
                  <Button size="sm" variant={p.seats > current.seats ? 'default' : 'outline'} className="w-full" onClick={() => (p.seats >= current.seats && p.monthlyCents >= current.monthlyCents ? run(actions.changePlan(p.id, null, me.id)) : setTarget(p))}>
                    {p.seats >= current.seats && p.monthlyCents >= current.monthlyCents ? 'Upgrade' : 'Downgrade'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
      {target && <Downgrade target={target} onClose={() => setTarget(null)} />}
    </>
  )
}

function Downgrade({ target, onClose }: { target: Plan; onClose: () => void }) {
  const db = useDB()
  const me = useStaffViewer()!
  const candidates = db.staff.filter((s) => s.status === 'active' || s.status === 'invited')
  const owner = db.staff.find((s) => s.role === 'owner')!
  const [keep, setKeep] = React.useState<string[]>([owner.id])
  const leaving = candidates.filter((s) => !keep.includes(s.id))
  const future = (id: string) => db.appointments.filter((a) => a.coachId === id && a.status === 'scheduled' && new Date(a.start) > new Date()).length
  const openTasks = (id: string) => db.tasks.filter((t) => t.assigneeId === id && t.status === 'open').length
  const lost = []
  if (target.sms === 0 && db.business.policies.smsEnabled) lost.push('SMS reminders stop; email reminders continue')
  if (target.aiDrafts < db.business.usage.aiDraftsThisMonth) lost.push(`Follow-up drafts limited to ${target.aiDrafts} per month`)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Downgrade to {target.name}</DialogTitle>
          <DialogDescription>Choose who stays active ({target.seats} seat{target.seats > 1 ? 's' : ''}). The change takes effect at your next renewal, and only once preparation is complete.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {candidates.map((s) => {
            const f = future(s.id)
            const t = openTasks(s.id)
            const leavingNow = !keep.includes(s.id)
            return (
              <Label key={s.id} className={cn('flex items-center gap-3 rounded-md border p-3 font-normal', leavingNow && f > 0 && 'border-warning/60')}>
                <Checkbox checked={keep.includes(s.id)} disabled={s.id === owner.id} onCheckedChange={(v) => setKeep((k) => (v ? [...k, s.id] : k.filter((x) => x !== s.id)))} />
                <span className="flex-1">
                  {s.name} <span className="text-muted-foreground text-xs">· {s.role}{s.status === 'invited' ? ' (invited)' : ''}</span>
                  {leavingNow && (f > 0 || t > 0) && <span className="text-warning block text-xs">{f} upcoming session{f === 1 ? '' : 's'} and {t} open task{t === 1 ? '' : 's'} need a handover</span>}
                </span>
              </Label>
            )
          })}
        </div>
        <div className={cn('text-sm', keep.length > target.seats ? 'text-destructive' : 'text-muted-foreground')}>{keep.length} of {target.seats} seats selected</div>
        {lost.length > 0 && (
          <Alert variant="warning"><TriangleAlert /><AlertTitle>Features that change</AlertTitle><AlertDescription>{lost.map((l) => <p key={l}>{l}</p>)}</AlertDescription></Alert>
        )}
        {leaving.some((s) => future(s.id) > 0) && <p className="text-muted-foreground text-xs">Upcoming sessions are never cancelled silently. Reassign those clients (Clients → Access) before the renewal date, or activation is blocked and you stay on your current plan.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Keep current plan</Button>
          <Button onClick={() => run(actions.changePlan(target.id, keep, me.id)) && onClose()} disabled={keep.length > target.seats}>Schedule downgrade</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
