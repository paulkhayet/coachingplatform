'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/app/dashboard', label: 'Overview' },
  { href: '/app/dashboard/intake', label: 'Intake' },
  { href: '/app/dashboard/assignments', label: 'Assignments' },
  { href: '/app/dashboard/finances', label: 'Finances', owner: true },
]

export function DashboardTabs({ owner }: { owner: boolean }) {
  const path = usePathname()
  return (
    <nav aria-label="Dashboard sections" className="-mb-px flex gap-5 overflow-x-auto border-b">
      {tabs.filter((t) => !t.owner || owner).map((t) => {
        const active = t.href === '/app/dashboard' ? path === t.href : path.startsWith(t.href)
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
            className={cn('text-muted-foreground hover:text-foreground border-b-2 border-transparent px-0.5 py-2.5 text-sm whitespace-nowrap', active && 'border-primary text-foreground font-medium')}>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
