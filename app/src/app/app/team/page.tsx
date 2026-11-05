import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { roleLabel } from '@/lib/roles'
import type { MemberRole } from '@/db/schema'

export const metadata: Metadata = { title: 'Team' }

type Row = { id: string; user_id: string; role: MemberRole; status: string; title: string | null; coaches: boolean }

export default async function TeamPage() {
  const { business, user } = await requireWorkspace()
  const supabase = await createClient()
  // Row-level security limits both queries to this business and its members.
  const { data: members } = await supabase.from('memberships').select('id, user_id, role, status, title, coaches').eq('business_id', business.id).order('created_at').returns<Row[]>()
  const ids = (members ?? []).map((m) => m.user_id)
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] }
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as { full_name: string | null; email: string | null }]))

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground mt-1 text-sm">Everyone with access to {business.name}. Inviting staff arrives with the team features.</p>
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
                    <TableCell className="pr-5"><Badge variant="outline" className="capitalize">{m.status}</Badge></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
