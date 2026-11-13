'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, CreditCard, HandCoins, Inbox, Plug, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const sections = [
  { href: '/app/settings', label: 'Profile', icon: UserRound },
  { href: '/app/settings/integrations', label: 'Integrations', icon: Plug },
  { href: '/app/settings/business', label: 'Business', icon: Building2 },
  // The team dashboard's settings (D-074).
  { href: '/app/settings/intake', label: 'Intake form', icon: Inbox, managerOnly: true },
  { href: '/app/settings/coach-pay', label: 'Coach pay', icon: HandCoins, ownerOnly: true },
  { href: '/app/settings/subscription', label: 'Subscription', icon: CreditCard, ownerOnly: true },
]

export function SettingsNav({ owner, manager }: { owner: boolean; manager: boolean }) {
  const path = usePathname()
  return (
    <nav aria-label="Settings sections" className="flex flex-wrap gap-x-4 border-b md:sticky md:top-20 md:flex-col md:flex-nowrap md:gap-0.5 md:self-start md:border-b-0">
      {sections.filter((section) => (!section.ownerOnly || owner) && (!section.managerOnly || manager)).map((section) => {
        const active = path === section.href
        return (
          <Link key={section.href} href={section.href} aria-current={active ? 'page' : undefined}
            className={cn(
              'text-muted-foreground hover:text-foreground -mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-0.5 py-2.5 text-sm',
              'md:hover:bg-accent md:mb-0 md:h-8 md:gap-2.5 md:rounded-md md:border-b-0 md:px-2 md:py-0',
              active && 'border-primary text-foreground font-medium md:bg-accent',
            )}>
            <section.icon className="size-4" aria-hidden="true" />
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
