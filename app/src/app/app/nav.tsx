'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/app', label: 'Today', icon: Home },
  { href: '/app/team', label: 'Team', icon: UsersRound },
]

export function Nav() {
  const path = usePathname()
  return (
    <nav className="grid gap-0.5">
      {items.map((it) => {
        const active = it.href === '/app' ? path === '/app' : path.startsWith(it.href)
        return (
          <Link key={it.href} href={it.href} className={cn('text-sidebar-foreground hover:bg-sidebar-accent flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors', active && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium')}>
            <it.icon className="size-4" /> {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
