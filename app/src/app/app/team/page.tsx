import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canManageTeam, roleLabel } from '@/lib/roles'
import type { MemberRole } from '@/db/schema'
import { freeTimes } from '@/lib/booking/server'
import { zonedParts, zonedTime } from '@/lib/slots'
import { InvitationActions, InviteForm, LeaveBusiness, RemoveMemberButton } from './forms'

export const metadata: Metadata = { title: 'Team' }

type Row = { id: string; user_id: string; role: MemberRole; status: string; title: string | null; coaches: boolean }

export default async function TeamPage() {
  const { business, user, membership } = await requireWorkspace()
  const isOwner = canManageTeam(membership.role)
  const supabase = await createClient()
  // Row-level security limits both queries to this business and its members.
  const { data: members } = await supabase.from('memberships').select('id, user_id, role, status, title, coaches').eq('business_id', business.id).order('created_at').returns<Row[]>()
  const ids = (members ?? []).map((m) => m.user_id)
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] }
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as { full_name: string | null; email: string | null }]))
  // Owners only (row-level security returns nothing for anyone else).
  const { data: invites } = isOwner
    ? await supabase.from('invitations').select('id, email, role, created_at, expires_at').eq('business_id', business.id).is('accepted_at', null).order('created_at', { ascending: false }).returns<{ id: string; email: string; role: MemberRole; created_at: string; expires_at: string }[]>()
    : { data: [] }
  const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: business.timezone })

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground mt-1 text-sm">Everyone with access to {business.name}.{isOwner ? ' Invite coaches and administrators by email; people who already use schedulefa.st keep one account for all their businesses.' : ''}</p>
      </div>
      <Card className="pb-0">
        <CardHeader>
          <CardTitle>{members?.length ?? 0} {members?.length === 1 ? 'member' : 'members'}</CardTitle>
          <CardDescription>Parents and students never use staff seats.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead className="pl-5">Name</TableHead><TableHead>Role</TableHead><TableHead className="pr-5">Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((m) => {
                const p = byId.get(m.user_id)
                const name = p?.full_name ?? p?.email ?? 'Unknown'
                return (
                  <TableRow key={m.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} />
                        <div>
                          <div className="font-medium">{name}{m.user_id === user.id && <span className="text-muted-foreground font-normal"> (you)</span>}</div>
                          <div className="text-muted-foreground text-xs">{p?.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{roleLabel[m.role]}{m.role !== 'coach' && m.coaches && <span className="text-muted-foreground text-xs"> + coaching</span>}</TableCell>
                    <TableCell className="pr-5">
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant="outline" className="capitalize">{m.status}</Badge>
                        {isOwner && m.role !== 'owner' && m.user_id !== user.id && m.status === 'active' && <RemoveMemberButton membershipId={m.id} name={name} businessName={business.name} />}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
            <CardDescription>They get an email with a link to join {business.name}. Their hours, calendar and other businesses stay theirs; you’ll see when they’re free for you.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <InviteForm businessName={business.name} />
            {(invites?.length ?? 0) > 0 && (
              <div className="grid gap-2">
                <p className="text-sm font-medium">Waiting to join</p>
                <ul className="divide-y rounded-md border">
                  {invites!.map((inv) => {
                    const expired = new Date(inv.expires_at) <= new Date()
                    return (
                      <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{inv.email}</p>
                          <p className="text-muted-foreground text-xs">{roleLabel[inv.role]} · {expired ? <span className="text-destructive">expired {dateFmt.format(new Date(inv.expires_at))}</span> : `invited ${dateFmt.format(new Date(inv.created_at))}, expires ${dateFmt.format(new Date(inv.expires_at))}`}</p>
                        </div>
                        <InvitationActions invitationId={inv.id} email={inv.email} />
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {isOwner && <TeamFreeTimes coaches={(members ?? []).filter((m) => m.coaches && m.status === 'active').map((m) => ({ id: m.id, name: byId.get(m.user_id)?.full_name ?? byId.get(m.user_id)?.email ?? 'Unknown' }))} businessName={business.name} timezone={business.timezone} />}
      {membership.role !== 'owner' && (
        <Card>
          <CardHeader>
            <CardTitle>Leave {business.name}</CardTitle>
            <CardDescription>You’ll lose access to {business.name}. Your account and your other businesses stay as they are.</CardDescription>
          </CardHeader>
          <CardContent><LeaveBusiness businessName={business.name} /></CardContent>
        </Card>
      )}
    </div>
  )
}

const DAYS = 7

/** D-058: owners see when each coach is free for this business this week, without any details. */
async function TeamFreeTimes({ coaches, businessName, timezone }: { coaches: { id: string; name: string }[]; businessName: string; timezone: string }) {
  if (coaches.length === 0) return null
  const now = new Date()
  const today = zonedParts(now, timezone)
  const until = zonedTime(today.year, today.month, today.day + DAYS, 0, timezone)
  const results = await Promise.all(coaches.map(async (c) => ({ ...c, free: await freeTimes(c.id, now, until, now).catch(() => 'unknown' as const) })))
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric' })
  const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Free times this week</CardTitle>
        <CardDescription>When each coach can take {businessName} calls, in your business time zone. Only free times are shown; what makes someone busy stays private.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {results.map((c) => {
          const byDay = new Map<string, string[]>()
          if (Array.isArray(c.free)) for (const iv of c.free) byDay.set(dayFmt.format(iv.start), [...(byDay.get(dayFmt.format(iv.start)) ?? []), `${timeFmt.format(iv.start)} – ${timeFmt.format(iv.end)}`])
          return (
            <div key={c.id} className="grid gap-1.5">
              <p className="text-sm font-medium">{c.name}</p>
              {c.free === null ? (
                <p className="text-muted-foreground text-xs">Can’t be shown right now.</p>
              ) : c.free === 'unknown' ? (
                <p className="text-muted-foreground text-xs">Can’t be shown right now (their calendar couldn’t be read).</p>
              ) : byDay.size === 0 ? (
                <p className="text-muted-foreground text-xs">No free time this week.</p>
              ) : (
                <dl className="grid gap-1 text-xs">
                  {[...byDay].map(([day, ranges]) => (
                    <div key={day} className="flex gap-3"><dt className="w-24 shrink-0">{day}</dt><dd className="text-muted-foreground">{ranges.join(', ')}</dd></div>
                  ))}
                </dl>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
