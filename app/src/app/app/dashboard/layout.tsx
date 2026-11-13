import { dashboardAccess } from '@/lib/insights/server'
import { DashboardTabs } from './tabs'

/** The team dashboard (D-074). Tabs are for owners and administrators on the Team plan; each page checks access itself. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await dashboardAccess()
  if (!access.enabled || !access.manager) return <div data-layout="flush" className="mx-auto w-full max-w-6xl">{children}</div>
  return (
    <div data-layout="flush" className="mx-auto grid w-full max-w-6xl gap-6">
      <header className="grid min-w-0 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Intake, coaches and {access.owner ? 'finances' : 'what needs attention'} for {access.business.name}.</p>
        </div>
        <DashboardTabs owner={access.owner} />
      </header>
      {/* min-w-0 lets wide tables scroll inside their cards instead of stretching the page on phones. */}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
