import Link from 'next/link'
import { Logo } from '@/components/brand'
import { SetupNotice } from '@/components/setup-notice'
import { SiteFooter } from '@/components/site-footer'
import { isSupabaseConfigured } from '@/lib/env'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center p-6">
      <div className="grid w-full max-w-sm justify-items-center gap-6">
        <Link href="/" aria-label="schedulefa.st home"><Logo className="text-xl [&_svg]:size-7" /></Link>
        {isSupabaseConfigured ? children : <SetupNotice />}
        <SiteFooter />
      </div>
    </main>
  )
}
