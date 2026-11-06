'use client'

import Link from 'next/link'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { roleLabel } from '@/lib/roles'
import type { MemberRole } from '@/db/schema'
import { switchBusiness } from './switch-actions'

/** The business name in the sidebar, which opens a menu to switch between businesses (D-057). */
export function BusinessSwitcher({ current, slug, workspaces }: { current: { id: string; name: string }; slug: string; workspaces: { businessId: string; name: string; role: MemberRole }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-sidebar-accent flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left outline-none">
        <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold">{current.name[0]?.toUpperCase()}</div>
        <div className="grid min-w-0 flex-1 leading-tight">
          <span className="truncate text-sm font-semibold">{current.name}</span>
          <span className="text-muted-foreground truncate text-xs">schedulefa.st/b/{slug}</span>
        </div>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Your businesses</DropdownMenuLabel>
        {workspaces.map((w) => (
          <form key={w.businessId} action={switchBusiness}>
            <input type="hidden" name="businessId" value={w.businessId} />
            <DropdownMenuItem asChild>
              <button type="submit" className="flex w-full items-center gap-2">
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate">{w.name}</span>
                  <span className="text-muted-foreground text-xs">{roleLabel[w.role]}</span>
                </span>
                {w.businessId === current.id && <Check className="size-4" />}
              </button>
            </DropdownMenuItem>
          </form>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?another=1" className="flex items-center gap-2"><Plus className="size-4" /> Create another business</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
