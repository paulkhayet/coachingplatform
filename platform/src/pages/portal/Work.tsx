import * as React from 'react'
import { Navigate } from 'react-router'
import { Sparkles, Clock, FileText, Download, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Empty } from '@/components/page'
import { useDB, useViewer, actions } from '@/lib/store'
import { relative, shortDate } from '@/lib/format'
import { run } from '@/components/run'
import { portalContext } from './context'
import { visibleFollowUps } from './Home'
import { toast } from 'sonner'

export function PortalFollowUps() {
  const db = useDB()
  const ctx = portalContext(db, useViewer())
  if (!ctx.perms.followUps) return <Navigate to="/portal" replace />
  const list = visibleFollowUps(db, ctx).sort((a, b) => (b.f.publishedAt ?? '').localeCompare(a.f.publishedAt ?? ''))
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
        <p className="text-muted-foreground text-sm">{ctx.isStudent ? 'Notes and next steps from your sessions.' : `Updates your coach has shared with you about ${ctx.student.name.split(' ')[0]}.`}</p>
      </div>
      {list.length ? list.map(({ f, v }) => (
        <Card key={f.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary size-4" /> {v.subject}</CardTitle>
            <CardDescription>From {db.staff.find((s) => s.id === f.coachId)?.name} · {f.publishedAt && relative(f.publishedAt)}</CardDescription>
          </CardHeader>
          <CardContent><p className="text-sm leading-relaxed whitespace-pre-line">{v.body}</p></CardContent>
        </Card>
      )) : <Empty icon={<Sparkles />} title="No follow-ups yet">They’ll appear here after your coach shares them.</Empty>}
    </div>
  )
}

export function PortalHomework() {
  const db = useDB()
  const ctx = portalContext(db, useViewer())
  const [resp, setResp] = React.useState<Record<string, string>>({})
  if (!ctx.perms.homework) return <Navigate to="/portal" replace />
  const list = db.homework.filter((h) => h.studentId === ctx.student.id && h.status !== 'draft' && (ctx.isStudent || h.guardiansCanSee))
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Homework</h1>
        <p className="text-muted-foreground text-sm">{ctx.isStudent ? 'Mark things done and leave your coach a quick note.' : 'You can see homework your coach shared with parents. Only the student marks it complete.'}</p>
      </div>
      {list.length ? list.map((h) => (
        <Card key={h.id}>
          <CardHeader>
            <CardTitle>{h.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              {h.due && <span className="flex items-center gap-1"><Clock className="size-3.5" /> Due {shortDate(h.due)}</span>}
              <StatusBadge tone={h.status === 'assigned' ? 'info' : 'success'}>{h.status === 'assigned' ? 'To do' : h.status === 'complete' ? 'Done' : 'Reviewed by coach'}</StatusBadge>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm">{h.instructions}</p>
            {h.fileIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {h.fileIds.map((id) => db.files.find((f) => f.id === id)).filter(Boolean).map((f) => (
                  <Button key={f!.id} size="sm" variant="outline" onClick={() => toast.success(`${f!.name} downloaded (demo)`)}><FileText /> {f!.name}</Button>
                ))}
              </div>
            )}
            {h.response && <div className="bg-muted/60 rounded-md p-3 text-sm">“{h.response}”</div>}
            {ctx.isStudent && h.status === 'assigned' && (
              <div className="grid gap-2">
                <Textarea placeholder="How did it go? (optional)" value={resp[h.id] ?? ''} onChange={(e) => setResp({ ...resp, [h.id]: e.target.value })} />
                <Button size="sm" className="justify-self-start" onClick={() => run(actions.setHomeworkStatus(h.id, 'complete', resp[h.id]), 'Nice work — your coach was notified')}><Check /> Mark done</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )) : <Empty title="No homework yet" />}
    </div>
  )
}

export function PortalFiles() {
  const db = useDB()
  const ctx = portalContext(db, useViewer())
  if (!ctx.perms.homework) return <Navigate to="/portal" replace />
  const files = db.files.filter((f) => f.studentIds.includes(ctx.student.id))
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
        <p className="text-muted-foreground text-sm">Resources your coach has shared.</p>
      </div>
      <Card className="py-2">
        <CardContent className="grid gap-1">
          {files.length ? files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 border-b py-3 last:border-0">
              <FileText className="text-muted-foreground size-5" />
              <div className="flex-1"><div className="text-sm font-medium">{f.name}</div><div className="text-muted-foreground text-xs">{f.sizeKb} KB · shared {relative(f.createdAt)}</div></div>
              <Button size="sm" variant="outline" onClick={() => toast.success(`${f.name} downloaded (demo)`)}><Download /> Download</Button>
            </div>
          )) : <Empty title="No files shared yet" />}
        </CardContent>
      </Card>
    </div>
  )
}
