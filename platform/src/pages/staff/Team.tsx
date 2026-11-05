import * as React from 'react'
import { UserPlus, MoreHorizontal, CircleCheck, CircleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, Field } from '@/components/page'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { canManageTeam } from '@/lib/permissions'
import { planById } from '@/lib/plans'
import { relative } from '@/lib/format'
import { run } from '@/components/run'
import type { Role } from '@/lib/types'

const roleName: Record<Role, string> = { owner: 'Owner', admin: 'Administrator', coach: 'Coach' }

export default function Team() {
  const db = useDB()
  const me = useStaffViewer()!
  const manage = canManageTeam(me)
  const plan = planById(db.business.plan)
  const active = db.staff.filter((s) => s.status === 'active').length
  const invited = db.staff.filter((s) => s.status === 'invited').length
  const [invite, setInvite] = React.useState(false)
  const [f, setF] = React.useState({ name: '', email: '', role: 'coach' as Role, title: '' })

  return (
    <>
      <PageHeader
        title="Team"
        description="Owners, administrators and coaches. Parent and student portal access never uses staff seats."
        actions={manage && <Button size="sm" onClick={() => setInvite(true)}><UserPlus /> Invite staff</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Staff seats</CardTitle>
            <CardDescription>{plan.name} plan · {plan.seats} seats</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Progress value={0} segments={[{ value: (active / plan.seats) * 100, className: 'bg-primary' }, { value: (invited / plan.seats) * 100, className: 'bg-primary/40' }]} />
            <div className="text-muted-foreground text-xs">{active} active · {invited} reserved by pending invitations · {plan.seats - active - invited} available</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Coach pools</CardTitle>
            <CardDescription>A purchase’s allowance works across eligible coaches in the pool.</CardDescription>
          </CardHeader>
          <CardContent>
            {db.pools.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{p.name}</span>
                {p.coachIds.map((id) => <Badge key={id} variant="secondary">{db.staff.find((s) => s.id === id)?.name}</Badge>)}
              </div>
            ))}
            <p className="text-muted-foreground mt-2 text-xs">Pool bookings grant temporary access for the booked sessions plus {db.business.policies.poolAccessDays} days.</p>
          </CardContent>
        </Card>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Clients</TableHead>
              <TableHead className="hidden md:table-cell">Google Calendar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {db.staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.name} />
                    <div>
                      <div className="font-medium">{s.name}{s.id === me.id && <span className="text-muted-foreground font-normal"> (you)</span>}</div>
                      <div className="text-muted-foreground text-xs">{s.title} · {s.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{roleName[s.role]}{s.role !== 'coach' && s.coaches && <span className="text-muted-foreground text-xs"> + coaching</span>}</TableCell>
                <TableCell className="hidden md:table-cell">{db.students.filter((x) => x.assignedCoachId === s.id && x.status === 'active').length || '—'}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {!s.coaches ? <span className="text-muted-foreground text-xs">Not coaching</span> : s.googleConnected && s.calendarHealthy ? <span className="flex items-center gap-1 text-xs"><CircleCheck className="text-success size-3.5" /> Connected</span> : <span className="flex items-center gap-1 text-xs"><CircleAlert className="text-warning size-3.5" /> {s.googleConnected ? 'Sync stale' : 'Not connected'}</span>}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={s.status === 'active' ? 'success' : s.status === 'invited' ? 'info' : 'neutral'}>{s.status === 'invited' ? `Invited ${s.invitedAt ? relative(s.invitedAt) : ''}` : s.status === 'active' ? 'Active' : 'Inactive'}</StatusBadge>
                </TableCell>
                <TableCell className="pr-5 text-right">
                  {manage && s.role !== 'owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Manage ${s.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {s.status === 'invited' ? (
                          <DropdownMenuItem variant="destructive" onSelect={() => run(actions.removeInvite(s.id, me.id), 'Invitation revoked; seat released')}>Revoke invitation</DropdownMenuItem>
                        ) : (
                          <>
                            {s.role === 'coach' && <DropdownMenuItem onSelect={() => run(actions.updateStaff(s.id, { role: 'admin', financial: false }, me.id), 'Now an administrator')}>Make administrator</DropdownMenuItem>}
                            {s.role === 'admin' && <DropdownMenuItem onSelect={() => run(actions.updateStaff(s.id, { role: 'coach', coaches: true }, me.id), 'Now a coach')}>Make coach</DropdownMenuItem>}
                            {s.role === 'admin' && <DropdownMenuItem onSelect={() => run(actions.updateStaff(s.id, { financial: !s.financial }, me.id), s.financial ? 'Financial actions removed' : 'Financial actions delegated')}>{s.financial ? 'Remove financial actions' : 'Delegate financial actions'}</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            {s.status === 'active' ? (
                              <DropdownMenuItem variant="destructive" onSelect={() => run(actions.updateStaff(s.id, { status: 'inactive' }, me.id), `${s.name} deactivated; records keep their attribution`)}>Deactivate</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => run(actions.updateStaff(s.id, { status: 'active' }, me.id), 'Reactivated')}>Reactivate</DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={invite} onOpenChange={setInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a staff member</DialogTitle>
            <DialogDescription>The invitation reserves a seat until it’s accepted, revoked, or expires.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as Role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="coach">Coach</SelectItem><SelectItem value="admin">Administrator</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Study skills coach" /></Field>
            </div>
            <p className="text-muted-foreground text-xs">{f.role === 'coach' ? 'Coaches never see prices or payment amounts. They see assigned clients only.' : 'Administrators handle operations and pricing. Private coaching notes need a separate grant.'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvite(false)}>Cancel</Button>
            <Button onClick={() => { if (!f.name || !f.email.includes('@')) return run({ ok: false, error: 'Add a name and a valid email.' }); if (run(actions.inviteStaff(f, me.id), 'Invitation sent')) { setInvite(false); setF({ name: '', email: '', role: 'coach', title: '' }) } }}>Send invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
