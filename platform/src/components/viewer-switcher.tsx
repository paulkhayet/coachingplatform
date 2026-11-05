import { useNavigate } from 'react-router'
import { ChevronsUpDown, RotateCcw, Globe, FileSignature } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar } from '@/components/ui/avatar'
import { useDB, useStore, useViewer } from '@/lib/store'
import type { Viewer } from '@/lib/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function viewerName(db: ReturnType<typeof useDB>, v: Viewer) {
  if (v.kind === 'staff') return db.staff.find((s) => s.id === v.id)?.name ?? 'Staff'
  if (v.kind === 'guardian') return db.guardians.find((g) => g.id === v.id)?.name ?? 'Guardian'
  return db.students.find((s) => s.id === v.id)?.name ?? 'Student'
}

const roleLabel = { owner: 'Owner', admin: 'Administrator', coach: 'Coach' }

export function ViewerSwitcher({ compact, className }: { compact?: boolean; className?: string }) {
  const db = useDB()
  const viewer = useViewer()
  const setViewer = useStore((s) => s.setViewer)
  const reset = useStore((s) => s.reset)
  const nav = useNavigate()
  const name = viewerName(db, viewer)
  const sub = viewer.kind === 'staff' ? roleLabel[db.staff.find((s) => s.id === viewer.id)?.role ?? 'coach'] : viewer.kind === 'guardian' ? 'Parent' : 'Student'

  const go = (v: Viewer, path: string) => {
    setViewer(v)
    nav(path)
  }
  const families = [
    { label: 'Rachel Reynolds', sub: 'Parent of Sophie · full access', v: { kind: 'guardian', id: 'g_rachel', studentId: 's_sophie' } as Viewer },
    { label: 'Tom Reynolds', sub: 'Parent of Sophie · no billing or booking', v: { kind: 'guardian', id: 'g_tom', studentId: 's_sophie' } as Viewer },
    { label: 'Dana Carter', sub: 'Parent of Noah · payment due', v: { kind: 'guardian', id: 'g_dana', studentId: 's_noah' } as Viewer },
    { label: 'Sophie Reynolds', sub: 'Student · can self-book', v: { kind: 'student', id: 's_sophie' } as Viewer },
    { label: 'Ethan Brooks', sub: 'Student · has a makeup credit', v: { kind: 'student', id: 's_ethan' } as Viewer },
    { label: 'Maya Ortiz', sub: 'Independent college student', v: { kind: 'student', id: 's_maya' } as Viewer },
  ]
  const openOffer = db.offers.find((o) => o.status !== 'paid' && o.status !== 'voided')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn('hover:bg-accent flex items-center gap-2 rounded-md p-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}>
        <Avatar name={name} className="size-7" />
        {!compact && (
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="text-muted-foreground truncate text-xs">{sub}</span>
          </span>
        )}
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>View the demo as staff</DropdownMenuLabel>
        {db.staff
          .filter((s) => s.status === 'active')
          .map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => go({ kind: 'staff', id: s.id }, '/app')}>
              <Avatar name={s.name} className="size-6 text-[10px]" />
              <span className="grid leading-tight">
                <span>{s.name}</span>
                <span className="text-muted-foreground text-xs">
                  {roleLabel[s.role]}
                  {s.role !== 'coach' && s.coaches ? ' + coach' : ''}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>View as a family</DropdownMenuLabel>
        {families.map((f) => (
          <DropdownMenuItem key={f.label} onSelect={() => go(f.v, '/portal')}>
            <Avatar name={f.label} className="size-6 text-[10px]" />
            <span className="grid leading-tight">
              <span>{f.label}</span>
              <span className="text-muted-foreground text-xs">{f.sub}</span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => nav(`/b/${db.business.slug}`)}>
          <Globe /> Public booking page
        </DropdownMenuItem>
        {openOffer && (
          <DropdownMenuItem onSelect={() => nav(`/offer/${openOffer.token}`)}>
            <FileSignature /> Guest offer link ({db.inquiries.find((i) => i.id === openOffer.inquiryId)?.studentName})
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            reset()
            toast.success('Demo data reset')
          }}
        >
          <RotateCcw /> Reset demo data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
