import * as React from 'react'
import { useNavigate } from 'react-router'
import { Search, UserPlus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageHeader, Empty, Field } from '@/components/page'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { clientAccess, visibleStudents, isFinancial } from '@/lib/permissions'
import { activePurchases, purchaseBalance } from '@/lib/credits'
import { num, shortDate, time } from '@/lib/format'
import { run } from '@/components/run'
import type { Student } from '@/lib/types'
import { Info } from 'lucide-react'

export const enrollmentTone: Record<Student['status'], ['success' | 'warning' | 'neutral' | 'info', string]> = {
  prospect: ['info', 'Prospect'],
  pending: ['warning', 'Pending requirements'],
  active: ['success', 'Active'],
  completed: ['neutral', 'Completed'],
}

export default function Clients() {
  const db = useDB()
  const me = useStaffViewer()!
  const nav = useNavigate()
  const [q, setQ] = React.useState('')
  const [adding, setAdding] = React.useState(false)
  const list = visibleStudents(db, me).filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHeader
        title="Clients"
        description={me.role === 'coach' ? 'Clients assigned to you, plus any you can see through a pool booking or grant.' : 'Every student, their family, and where their coaching stands.'}
        actions={
          isFinancial(me) && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <UserPlus /> Add existing client
            </Button>
          )
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <Card className="py-0">
        {list.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Student</TableHead>
                <TableHead className="hidden md:table-cell">Coach</TableHead>
                <TableHead className="hidden lg:table-cell">Arrangement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Credits ready</TableHead>
                <TableHead className="hidden md:table-cell pr-5">Next session</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s) => {
                const p = activePurchases(db, s.id)[0]
                const bal = p ? purchaseBalance(db, p.id) : null
                const next = db.appointments.filter((a) => a.studentId === s.id && a.status === 'scheduled' && new Date(a.start) > new Date()).sort((a, b) => a.start.localeCompare(b.start))[0]
                const access = clientAccess(db, me, s)
                const [tone, label] = enrollmentTone[s.status]
                return (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => nav(`/app/clients/${s.id}`)}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} className="size-8" />
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            {s.name}
                            {access?.kind === 'pool' && <Badge variant="accent" className="text-[10px]">Pool</Badge>}
                            {access?.kind === 'grant' && <Badge variant="accent" className="text-[10px]">Granted</Badge>}
                          </div>
                          <div className="text-muted-foreground text-xs">{s.grade}{s.independent ? ' · independent' : ''}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{db.staff.find((x) => x.id === s.assignedCoachId)?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">{p?.name ?? '—'}</TableCell>
                    <TableCell><StatusBadge tone={tone}>{label}</StatusBadge></TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{bal ? `${num(bal.usableFunded)} funded · ${num(Math.max(0, bal.remainingEntitlement))} unbooked` : '—'}</TableCell>
                    <TableCell className="text-muted-foreground hidden pr-5 md:table-cell">{next ? `${shortDate(next.start)}, ${time(next.start)}` : '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6"><Empty title="No clients found" /></div>
        )}
      </Card>
      <AddExistingClient open={adding} onOpenChange={setAdding} />
    </>
  )
}

function AddExistingClient({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useDB()
  const me = useStaffViewer()!
  const nav = useNavigate()
  const [f, setF] = React.useState({ name: '', grade: '', school: '', email: '', independent: false, guardianName: '', guardianEmail: '', coachId: 'st_priya', offeringId: 'off_semester', used: '0', paid: '', note: '' })
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))
  const submit = () => {
    if (!f.name.trim() || !f.grade.trim()) return run({ ok: false, error: 'Add the student’s name and grade.' })
    if (!f.independent && !f.guardianName.trim()) return run({ ok: false, error: 'Add a parent or guardian, or mark the student independent.' })
    const paidCents = Math.round(Number(f.paid || 0) * 100)
    if (paidCents > 0 && !f.note.trim()) return run({ ok: false, error: 'Record how the historical payment was verified.' })
    const r = actions.addExistingClient({ name: f.name, grade: f.grade, school: f.school, email: f.email || undefined, independent: f.independent, guardianName: f.guardianName, guardianEmail: f.guardianEmail, coachId: f.coachId, offeringId: f.offeringId, startDate: new Date(), usedCredits: Number(f.used || 0), paidCents, verifiedNote: f.note }, me.id)
    if (run(r, paidCents > 0 ? 'Client added with verified coverage. Portal invitation sent.' : 'Client added. Coverage stays pending until payment is verified.')) {
      onOpenChange(false)
      if (r.ok) nav(`/app/clients/${r.value}`)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add an existing client</DialogTitle>
          <DialogDescription>Manual entry for clients you already coach. Already-paid clients aren’t charged again just to move systems.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Student name"><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Alex Rivera" /></Field>
          <Field label="Grade or stage"><Input value={f.grade} onChange={(e) => set('grade', e.target.value)} placeholder="10th grade" /></Field>
          <Field label="School"><Input value={f.school} onChange={(e) => set('school', e.target.value)} /></Field>
          <Field label="Student email (optional)"><Input value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Label className="font-normal sm:col-span-2"><Switch checked={f.independent} onCheckedChange={(v) => set('independent', v)} /> Independent student (no parent account needed)</Label>
          {!f.independent && (
            <>
              <Field label="Parent or guardian"><Input value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} /></Field>
              <Field label="Their email"><Input value={f.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} /></Field>
            </>
          )}
          <Field label="Assigned coach">
            <Select value={f.coachId} onValueChange={(v) => set('coachId', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{db.staff.filter((s) => s.coaches && s.status === 'active').map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Current arrangement">
            <Select value={f.offeringId} onValueChange={(v) => set('offeringId', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{db.offerings.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Sessions already delivered"><Input type="number" min={0} value={f.used} onChange={(e) => set('used', e.target.value)} /></Field>
          <Field label="Amount already paid (USD)"><Input type="number" min={0} value={f.paid} onChange={(e) => set('paid', e.target.value)} placeholder="1200" /></Field>
          <Field label="How was payment verified?" className="sm:col-span-2" hint="Required to establish historical paid coverage. Recorded with your name.">
            <Input value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Invoice #1077 paid via bank transfer, confirmed in QuickBooks" />
          </Field>
        </div>
        <Alert variant="info"><Info /><AlertDescription>Manual entry and portal invitations never count as payment by themselves. Without verification, coverage stays pending.</AlertDescription></Alert>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Add client</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
