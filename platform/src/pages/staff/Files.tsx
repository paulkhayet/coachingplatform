import * as React from 'react'
import { FileText, Upload } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { PageHeader, Empty, Field } from '@/components/page'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { visibleStudents } from '@/lib/permissions'
import { relative } from '@/lib/format'
import { run } from '@/components/run'
import type { SharedFile } from '@/lib/types'

export default function Files() {
  const db = useDB()
  const me = useStaffViewer()!
  const students = visibleStudents(db, me)
  const visible = new Set(students.map((s) => s.id))
  const files = db.files.filter((f) => f.uploadedBy === me.id || me.role !== 'coach' || f.studentIds.some((id) => visible.has(id)))
  const [upload, setUpload] = React.useState<{ name: string; size: number } | null>(null)
  const [share, setShare] = React.useState<SharedFile | null>(null)
  const [sel, setSel] = React.useState<string[]>([])
  const input = React.useRef<HTMLInputElement>(null)

  return (
    <>
      <PageHeader
        title="Files"
        description="Resources and homework attachments. A file stays private until you choose who can see it; access is checked every time it’s opened."
        actions={
          <>
            <input ref={input} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setUpload({ name: f.name, size: Math.max(1, Math.round(f.size / 1024)) }); setSel([]) } e.target.value = '' }} />
            <Button size="sm" onClick={() => input.current?.click()}><Upload /> Upload file</Button>
          </>
        }
      />
      <Card className="py-0">
        {files.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Shared with</TableHead>
                <TableHead className="hidden sm:table-cell">Uploaded</TableHead>
                <TableHead className="pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="pl-5"><div className="flex items-center gap-2"><FileText className="text-muted-foreground size-4" /><span className="font-medium">{f.name}</span><span className="text-muted-foreground text-xs">{f.sizeKb} KB</span></div></TableCell>
                  <TableCell>{f.studentIds.length ? <div className="flex flex-wrap gap-1">{f.studentIds.map((id) => <Badge key={id} variant="secondary">{db.students.find((s) => s.id === id)?.name.split(' ')[0]}</Badge>)}</div> : <Badge variant="outline">Private</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">{db.staff.find((s) => s.id === f.uploadedBy)?.name} · {relative(f.createdAt)}</TableCell>
                  <TableCell className="pr-5 text-right">{(f.uploadedBy === me.id || me.role !== 'coach') && <Button variant="ghost" size="sm" onClick={() => { setShare(f); setSel(f.studentIds) }}>Sharing</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <div className="p-6"><Empty title="No files yet" /></div>}
      </Card>

      <Dialog open={!!upload || !!share} onOpenChange={(o) => { if (!o) { setUpload(null); setShare(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{upload ? `Upload ${upload.name}` : `Share ${share?.name}`}</DialogTitle>
            <DialogDescription>Choose which clients can download it. Removing access stops future downloads; it can’t recall copies already downloaded.</DialogDescription>
          </DialogHeader>
          <Field label="Shared with">
            <div className="grid max-h-64 gap-1.5 overflow-y-auto">
              {students.map((s) => (
                <Label key={s.id} className="rounded-md border p-2 font-normal">
                  <Checkbox checked={sel.includes(s.id)} onCheckedChange={(v) => setSel((x) => (v ? [...x, s.id] : x.filter((y) => y !== s.id)))} /> {s.name}
                </Label>
              ))}
            </div>
          </Field>
          <DialogFooter>
            <Button
              onClick={() => {
                const ok = upload ? run(actions.uploadFile(upload.name, upload.size, sel, me.id), 'File uploaded') : share ? run(actions.shareFile(share.id, sel), 'Sharing updated') : false
                if (ok) { setUpload(null); setShare(null) }
              }}
            >
              {upload ? 'Upload' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
