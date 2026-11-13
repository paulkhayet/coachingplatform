import Link from 'next/link'
import { LogOut, Sparkles } from 'lucide-react'
import { workspacePlan } from '@/lib/billing/server'
import { SUBSCRIPTION_PATH } from '@/lib/settings-paths'
import { Logo } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { requireWorkspace } from '@/lib/workspace'
import { profilePhotoUrl } from '@/lib/profile-photo'
import { businessLogoUrl } from '@/lib/business-logo'
import { canSeePricing, canUseDashboard, roleLabel } from '@/lib/roles'
import { signOut } from '../(auth)/actions'
import { Nav, SettingsLink } from './nav'
import { BusinessSwitcher } from './business-switcher'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, business, workspaces } = await requireWorkspace()
  const showPricing = canSeePricing(membership.role)
  const [photo, plan] = await Promise.all([profilePhotoUrl(user.avatarPath), workspacePlan(business.id)])
  const showUpgrade = membership.role === 'owner' && plan.plan === 'free'
  // Owners and administrators always see the Dashboard (with an upgrade card off the Team plan);
  // coaches get their own inquiries once the plan includes it.
  const dashboard = canUseDashboard(membership.role) ? 'full' as const : plan.limits.teamDashboard && membership.coaches ? 'intake' as const : null
  return (
    <div className="flex min-h-svh">
      <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r p-3 md:flex">
        <div className="mb-4 px-1 pt-1"><Logo /></div>
        <BusinessSwitcher current={{ id: business.id, name: business.name, logoUrl: businessLogoUrl(business.logo_path) }} slug={business.slug} workspaces={workspaces} />
        <div className="mt-5 flex-1"><Nav showPricing={showPricing} dashboard={dashboard} /></div>
        {showUpgrade && (
          <Link href={SUBSCRIPTION_PATH} className="bg-primary/5 hover:bg-primary/10 border-primary/20 mb-2 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
            <Sparkles className="text-primary size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="font-medium">Free plan</span> · Upgrade for more</span>
          </Link>
        )}
        <div className="mb-2"><SettingsLink /></div>
        <div className="flex items-center gap-2 border-t pt-3">
          <Avatar name={user.fullName} src={photo} className="size-7" />
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">{user.fullName}</span>
            <span className="text-muted-foreground truncate text-xs">{roleLabel[membership.role]}</span>
          </div>
          <form action={signOut}>
            <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out"><LogOut /></Button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/90 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
          <div className="md:hidden"><Logo /></div>
          <div className="w-48 md:hidden"><BusinessSwitcher current={{ id: business.id, name: business.name, logoUrl: businessLogoUrl(business.logo_path) }} slug={business.slug} workspaces={workspaces} /></div>
          <span className="text-muted-foreground hidden text-sm md:block">{business.name}</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <form action={signOut} className="md:hidden">
              <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out"><LogOut /></Button>
            </form>
          </div>
        </header>
        <div className="border-b px-4 py-2 md:hidden"><Nav showPricing={showPricing} dashboard={dashboard} withSettings /></div>
        {/* Pages are centred; a page marked data-layout="flush" (Settings) sits against the sidebar instead. */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8 has-[[data-layout=flush]]:mx-0 has-[[data-layout=flush]]:max-w-none">{children}</main>
      </div>
    </div>
  )
}
