import { LogOut } from 'lucide-react'
import { Logo } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { requireWorkspace } from '@/lib/workspace'
import { profilePhotoUrl } from '@/lib/profile-photo'
import { canSeePricing, roleLabel } from '@/lib/roles'
import { signOut } from '../(auth)/actions'
import { Nav } from './nav'
import { BusinessSwitcher } from './business-switcher'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, business, workspaces } = await requireWorkspace()
  const showPricing = canSeePricing(membership.role)
  const photo = await profilePhotoUrl(user.avatarPath)
  return (
    <div className="flex min-h-svh">
      <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r p-3 md:flex">
        <div className="mb-4 px-1 pt-1"><Logo /></div>
        <BusinessSwitcher current={{ id: business.id, name: business.name }} slug={business.slug} workspaces={workspaces} />
        <div className="mt-5 flex-1"><Nav showPricing={showPricing} /></div>
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
          <div className="w-48 md:hidden"><BusinessSwitcher current={{ id: business.id, name: business.name }} slug={business.slug} workspaces={workspaces} /></div>
          <span className="text-muted-foreground hidden text-sm md:block">{business.name}</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <form action={signOut} className="md:hidden">
              <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out"><LogOut /></Button>
            </form>
          </div>
        </header>
        <div className="border-b px-4 py-2 md:hidden"><Nav showPricing={showPricing} /></div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
