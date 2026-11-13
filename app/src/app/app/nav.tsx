'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, CalendarClock, ContactRound, Home, Inbox, LayoutDashboard, Link2, Package, Settings, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The team dashboard (D-074): everything for owners and administrators, their own inquiries for coaches. */
const dashboardItems = {
  full: { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  intake: { href: '/app/dashboard/intake', label: 'Inquiries', icon: Inbox },
}

const items = [
  { href: '/app', label: 'Today', icon: Home },
  { href: '/app/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '/app/booking-pages', label: 'Booking pages', icon: Link2 },
  { href: '/app/clients', label: 'Clients', icon: ContactRound },
  { href: '/app/coaching-packages', label: 'Coaching packages', icon: Package, pricing: true },
  { href: '/app/availability', label: 'Availability', icon: CalendarClock },
  { href: '/app/team', label: 'Team', icon: UsersRound },
]
const settings = { href: '/app/settings', label: 'Settings', icon: Settings }

function NavLink({ item }: { item: { href: string; label: string; icon: typeof Home } }) {
  const path = usePathname()
  const active = item.href === '/app' ? path === '/app' : path.startsWith(item.href)
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={cn('text-sidebar-foreground hover:bg-sidebar-accent flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors', active && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium')}>
      <item.icon className="size-4" /> {item.label}
    </Link>
  )
}

/** The main sections. On desktop Settings sits apart at the bottom of the sidebar; the mobile menu lists it last. */
export function Nav({ showPricing = false, withSettings = false, dashboard = null }: { showPricing?: boolean; withSettings?: boolean; dashboard?: 'full' | 'intake' | null }) {
  const visible = items.filter((it) => showPricing || !it.pricing)
  return (
    <nav className="grid gap-0.5">
      <NavLink item={visible[0]} />
      {dashboard && <NavLink item={dashboardItems[dashboard]} />}
      {visible.slice(1).map((it) => <NavLink key={it.href} item={it} />)}
      {withSettings && <NavLink item={settings} />}
    </nav>
  )
}

export function SettingsLink() {
  return <nav aria-label="Settings" className="grid"><NavLink item={settings} /></nav>
}
