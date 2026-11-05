import * as React from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { Logo } from '@/components/brand'
import { ViewerSwitcher } from '@/components/viewer-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { useDB, useViewer } from '@/lib/store'
import { cn } from '@/lib/utils'
import { portalContext } from '@/pages/portal/context'

export default function PortalLayout() {
  const db = useDB()
  const viewer = useViewer()
  const loc = useLocation()
  React.useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  if (viewer.kind === 'staff') return <Navigate to="/app" replace />
  const ctx = portalContext(db, viewer)
  const tabs = [
    { to: '/portal', label: 'Home', show: true },
    { to: '/portal/sessions', label: 'Sessions', show: true },
    { to: '/portal/follow-ups', label: 'Follow-ups', show: ctx.perms.followUps },
    { to: '/portal/homework', label: 'Homework', show: ctx.perms.homework },
    { to: '/portal/files', label: 'Files', show: ctx.perms.homework },
    { to: '/portal/billing', label: 'Billing', show: ctx.perms.billing },
  ].filter((t) => t.show)

  return (
    <div className="bg-muted/30 min-h-svh">
      <header className="bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold">W</div>
            <span className="text-sm font-semibold">{db.business.name}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <ViewerSwitcher />
          </div>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/portal'}
              className={({ isActive }) => cn('text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-3 py-2.5 text-sm whitespace-nowrap', isActive && 'border-primary text-foreground font-medium')}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-6 md:py-8">
        <Outlet />
      </main>
      <footer className="text-muted-foreground mx-auto flex max-w-4xl items-center justify-between px-4 pb-8 text-xs">
        <span>Powered by <Logo className="text-xs [&_svg]:size-3.5" /></span>
        <span>Demo · sample data</span>
      </footer>
    </div>
  )
}
