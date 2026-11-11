import { canManageTeam } from '@/lib/roles'
import { requireWorkspace } from '@/lib/workspace'
import { SettingsNav } from './nav'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { business, membership } = await requireWorkspace()
  return (
    <div data-layout="flush" className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your account and settings for {business.name}.</p>
      </header>
      {/* Section menu on the left from md up; a row of tabs above the content on phones. */}
      <div className="grid gap-6 md:grid-cols-[11rem_minmax(0,52rem)] md:gap-8">
        <SettingsNav showSubscription={canManageTeam(membership.role)} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
