import Link from 'next/link'
import { Logo } from '@/components/brand'
import { SiteFooter } from '@/components/site-footer'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b px-4 py-3 md:px-8">
        <Link href="/" aria-label="schedulefa.st home"><Logo /></Link>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 md:px-8 [&_a]:text-primary [&_a]:underline [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </main>
      <SiteFooter className="border-t px-4 py-6" />
    </div>
  )
}
