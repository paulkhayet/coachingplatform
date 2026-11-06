import Link from 'next/link'
import { Logo } from '@/components/brand'
import { SiteFooter } from '@/components/site-footer'

/** Public booking pages: no sign-in, minimal chrome. */
export default function PublicBookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 grid min-h-svh grid-rows-[1fr_auto]">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">{children}</main>
      <footer className="grid justify-items-center gap-2 p-6">
        <Link href="/" className="text-muted-foreground flex items-center gap-1.5 text-xs">Scheduling by <Logo className="text-xs [&_svg]:size-4" /></Link>
        <SiteFooter />
      </footer>
    </div>
  )
}
