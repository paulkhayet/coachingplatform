import * as React from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { Home, Inbox, Users, Calendar, CalendarRange, Sparkles, FolderOpen, TriangleAlert, Package, UsersRound, Settings, CreditCard, Menu } from 'lucide-react'
import { Logo } from '@/components/brand'
import { ViewerSwitcher } from '@/components/viewer-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useDB, useStaffViewer } from '@/lib/store'
import { canManageSaaS, canSeePricing, visibleStudents } from '@/lib/permissions'
import { planById } from '@/lib/plans'
import { cn } from '@/lib/utils'
import type { DB, Staff } from '@/lib/types'

interface Item {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  tone?: 'warn'
}

function navFor(db: DB, me: Staff): { label: string; items: Item[] }[] {
  const mine = (id: string) => id === me.id
  const inquiries = db.inquiries.filter((i) => !['enrolled', 'declined'].includes(i.stage) && (me.role !== 'coach' || i.matchedCoachId === me.id))
  const visible = new Set(visibleStudents(db, me).map((s) => s.id))
  const drafts = db.followUps.filter((f) => f.status === 'draft' && visible.has(f.studentId) && (me.role !== 'coach' || f.coachId === me.id))
  const issues = db.issues.filter((i) => i.status === 'open' && (me.role !== 'coach' || mine(i.ownerId)))
  const work: Item[] = [
    { to: '/app', label: 'Today', icon: Home },
    { to: '/app/inquiries', label: 'Inquiries', icon: Inbox, count: inquiries.filter((i) => i.stage === 'new' || (me.role === 'coach' && i.stage === 'consult_scheduled')).length || undefined },
    { to: '/app/clients', label: 'Clients', icon: Users },
    { to: '/app/calendar', label: 'Calendar', icon: Calendar },
    { to: '/app/booking-pages', label: 'Booking pages', icon: CalendarRange },
    { to: '/app/follow-ups', label: 'Follow-ups', icon: Sparkles, count: drafts.length || undefined },
    { to: '/app/files', label: 'Files', icon: FolderOpen },
    { to: '/app/issues', label: 'Issues', icon: TriangleAlert, count: issues.length || undefined, tone: 'warn' },
  ]
  const biz: Item[] = []
  if (canSeePricing(me)) biz.push({ to: '/app/offerings', label: 'Offerings', icon: Package })
  if (me.role !== 'coach') biz.push({ to: '/app/team', label: 'Team', icon: UsersRound })
  biz.push({ to: '/app/settings', label: me.role === 'coach' ? 'My settings' : 'Settings', icon: Settings })
  if (canManageSaaS(me)) biz.push({ to: '/app/plan', label: 'Plan and billing', icon: CreditCard })
  return [
    { label: 'Workspace', items: work },
    { label: 'Business', items: biz },
  ]
}

function Nav({ db, me, onNavigate }: { db: DB; me: Staff; onNavigate?: () => void }) {
  return (
    <nav className="grid gap-5">
      {navFor(db, me).map((g) => (
        <div key={g.label}>
          <div className="text-muted-foreground px-2 pb-1.5 text-xs font-medium">{g.label}</div>
          <div className="grid gap-0.5">
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === '/app'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'text-sidebar-foreground hover:bg-sidebar-accent flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors',
                    isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                  )
                }
              >
                <it.icon className="size-4" />
                {it.label}
                {it.count !== undefined && (
                  <span className={cn('ml-auto rounded-full px-1.5 text-xs tabular-nums', it.tone === 'warn' ? 'bg-warning/15 text-foreground' : 'text-muted-foreground')}>{it.count}</span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function Workspace({ db }: { db: DB }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-bold">W</div>
      <div className="grid leading-tight">
        <span className="text-sm font-semibold">{db.business.name}</span>
        <span className="text-muted-foreground text-xs">{planById(db.business.plan).name} plan</span>
      </div>
    </div>
  )
}

export default function StaffLayout() {
  const db = useDB()
  const me = useStaffViewer()
  const [open, setOpen] = React.useState(false)
  const loc = useLocation()
  React.useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  if (!me) return <Navigate to="/portal" replace />

  return (
    <div className="flex min-h-svh">
      <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r p-3 md:flex">
        <div className="mb-4 px-1 pt-1">
          <Logo />
        </div>
        <Workspace db={db} />
        <div className="mt-5 flex-1 overflow-y-auto">
          <Nav db={db} me={me} />
        </div>
        <ViewerSwitcher className="mt-3 w-full" />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="bg-sidebar p-3">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-4 px-1 pt-1"><Logo /></div>
          <Workspace db={db} />
          <div className="mt-5"><Nav db={db} me={me} onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/90 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="md:hidden"><Logo /></div>
          <div className="text-muted-foreground hidden text-sm md:block">
            Demo workspace · sample data · integrations simulated
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <ViewerSwitcher compact className="md:hidden" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
