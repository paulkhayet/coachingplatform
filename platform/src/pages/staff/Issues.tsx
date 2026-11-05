import * as React from 'react'
import { Link } from 'react-router'
import { CircleCheck, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { PageHeader, Empty } from '@/components/page'
import { IssueKindLabel } from '@/components/status'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { relative } from '@/lib/format'
import { run } from '@/components/run'

export default function Issues() {
  const db = useDB()
  const me = useStaffViewer()!
  const [tab, setTab] = React.useState<'open' | 'resolved'>('open')
  const [notes, setNotes] = React.useState<Record<string, string>>({})
  const list = db.issues.filter((i) => i.status === tab && (me.role !== 'coach' || i.ownerId === me.id))
  return (
    <>
      <PageHeader title="Issues" description="Provider failures, stale syncs, missing sources and delivery problems — each with an owner, safe retry, and history. Private content never appears here." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'resolved')} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-3">
        {list.length ? list.map((i) => (
          <Card key={i.id} className="py-4">
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-medium">{i.title} <Badge variant="outline"><IssueKindLabel kind={i.kind} /></Badge></div>
                  <div className="text-muted-foreground text-sm">{i.detail}</div>
                </div>
                <StatusBadge tone={i.status === 'open' ? 'warning' : 'success'}>{i.status === 'open' ? 'Open' : 'Resolved'}</StatusBadge>
              </div>
              <ol className="text-muted-foreground grid gap-1 border-l pl-3 text-xs">
                {i.history.map((h, k) => <li key={k}>{relative(h.at)} — {h.text}</li>)}
              </ol>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs">Owner: {db.staff.find((s) => s.id === i.ownerId)?.name}</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {i.link && <Button variant="outline" size="sm" asChild><Link to={i.link}>Go to fix <ArrowRight /></Link></Button>}
                  {i.status === 'open' && (
                    <>
                      <Input className="h-8 w-56" placeholder="Resolution note" value={notes[i.id] ?? ''} onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })} />
                      <Button size="sm" onClick={() => run(actions.resolveIssue(i.id, notes[i.id] ?? '', me.id), 'Issue resolved')}>Resolve</Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )) : <Empty icon={<CircleCheck />} title={tab === 'open' ? 'No open issues' : 'Nothing resolved yet'} />}
      </div>
    </>
  )
}
