'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, CreditCard, Plug, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const sections = [
  { href: '/app/settings', label: 'Profile', icon: UserRound },
  { href: '/app/settings/integrations', label: 'Integrations', icon: Plug },
  { href: '/app/settings/business', label: 'Business', icon: Building2 },
  { href: '/app/settings/subscription', label: 'Subscription', icon: CreditCard, ownerOnly: true },
]

export function SettingsNav({ showSubscription }: { showSubscription: boolean }) {
  const path = usePathname()
  return (
    <nav aria-label="Settings sections" className="flex flex-wrap gap-x-4 border-b">
      {sections.filter((section) => !section.ownerOnly || showSubscription).map((section) => {
        const active = path === section.href
        return (
          <Link key={section.href} href={section.href} aria-current={active ? 'page' : undefined}
            className={cn('text-muted-foreground hover:text-foreground -mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-0.5 py-2.5 text-sm', active && 'border-primary text-foreground font-medium')}>
            <section.icon className="size-4" aria-hidden="true" />
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
