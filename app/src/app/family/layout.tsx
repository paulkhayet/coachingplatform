import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Logo } from '@/components/brand'
import { SiteFooter } from '@/components/site-footer'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/workspace'
import { signOut } from '../(auth)/actions'

export const metadata: Metadata = { title: { default: 'Family portal', template: '%s · Family portal · schedulefa.st' }, robots: { index: false } }

/** The family portal (D-073): parents and guardians following a student's coaching. */
export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/sign-in?next=/family')
  // People who also work for a business can hop back to it.
  const supabase = await createClient()
  const { count } = await supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active')
  return (
    <div className="bg-muted/20 flex min-h-svh flex-col">
      <header className="bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-3 px-4 md:px-6">
          <Link href="/family" aria-label="Family portal home"><Logo /></Link>
          <span className="text-muted-foreground hidden text-sm sm:inline">Family portal</span>
          <div className="ml-auto flex items-center gap-1">
            {count ? <Button asChild variant="ghost" size="sm"><Link href="/app">Coach view</Link></Button> : null}
            <ThemeToggle />
            <form action={signOut}>
              <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out"><LogOut /></Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      <SiteFooter className="border-t px-4 py-6" />
    </div>
  )
}
