import { Link } from 'react-router'
import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { PageHeader, Empty } from '@/components/page'
import { useDB, useStaffViewer } from '@/lib/store'
import { visibleStudents, canReadPrivate } from '@/lib/permissions'
import { relative, shortDate } from '@/lib/format'

export default function FollowUps() {
  const db = useDB()
  const me = useStaffViewer()!
  const visible = new Set(visibleStudents(db, me).map((s) => s.id))
  const mine = (coachId: string) => me.role !== 'coach' || coachId === me.id
  const drafts = db.followUps.filter((f) => f.status === 'draft' && visible.has(f.studentId) && mine(f.coachId))
  const needSource = db.appointments.filter(
    (a) => a.status === 'attended' && a.kind === 'coaching' && a.studentId && visible.has(a.studentId) && mine(a.coachId) && !db.followUps.some((f) => f.appointmentId === a.id) && new Date(a.start) > new Date(Date.now() - 10 * 86400000),
  )
  const published = db.followUps.filter((f) => f.status === 'published' && visible.has(f.studentId) && mine(f.coachId)).sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
  const name = (id: string) => db.students.find((s) => s.id === id)!.name

  return (
    <>
      <PageHeader title="Follow-ups" description={`Mode: ${db.business.policies.followUpMode === 'manual' ? 'manual approval' : 'automatic sending for eligible sessions'}. Every draft is checked against recipient permissions before it goes out.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ready for review</CardTitle>
            <CardDescription>{drafts.length} draft{drafts.length === 1 ? '' : 's'}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {drafts.length ? drafts.map((f) => (
              <Link key={f.id} to={`/app/sessions/${f.appointmentId}`} className="hover:bg-muted/50 flex items-center gap-3 rounded-md border p-3 text-sm">
                <Avatar name={name(f.studentId)} />
                <span className="flex-1"><span className="font-medium">{name(f.studentId)}</span><span className="text-muted-foreground block text-xs">{f.mode === 'shared' ? 'Shared' : 'Student + parent'} · from {f.sourceKind === 'zoom' ? 'Zoom summary' : 'notes'} · {relative(f.createdAt)}</span></span>
                <StatusBadge tone="info">Review</StatusBadge>
              </Link>
            )) : <Empty icon={<Sparkles />} title="No drafts waiting" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sessions without a follow-up</CardTitle>
            <CardDescription>Attended in the last 10 days</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {needSource.length ? needSource.map((a) => (
              <Link key={a.id} to={`/app/sessions/${a.id}`} className="hover:bg-muted/50 flex items-center gap-3 rounded-md border p-3 text-sm">
                <Avatar name={name(a.studentId!)} />
                <span className="flex-1"><span className="font-medium">{name(a.studentId!)}</span><span className="text-muted-foreground block text-xs">{shortDate(a.start)} · {!canReadPrivate(db, me, a.studentId, a) ? 'Restricted source' : a.source?.status === 'ready' ? 'Source ready' : a.source?.status === 'unavailable' ? 'Zoom summary unavailable — add notes' : 'Waiting for source'}</span></span>
              </Link>
            )) : <Empty title="Everything has a follow-up" />}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Published</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {published.length ? published.map((f) => (
              <Link key={f.id} to={`/app/sessions/${f.appointmentId}`} className="hover:bg-muted/50 flex items-center gap-3 rounded-md border p-3 text-sm">
                <Avatar name={name(f.studentId)} />
                <span className="flex-1"><span className="font-medium">{f.versions[0].subject}</span><span className="text-muted-foreground block text-xs">{name(f.studentId)} · {f.deliveries.filter((d) => d.status !== 'held').length} delivered{f.deliveries.some((d) => d.status === 'held') ? ` · ${f.deliveries.filter((d) => d.status === 'held').length} held by permissions` : ''}</span></span>
                <span className="text-muted-foreground text-xs">{f.publishedAt && relative(f.publishedAt)}</span>
              </Link>
            )) : <Empty title="Nothing published yet" />}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
