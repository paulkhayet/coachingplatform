import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { SetupNotice } from '@/components/setup-notice'
import { SiteFooter } from '@/components/site-footer'
import { isSupabaseConfigured } from '@/lib/env'
import { getUser } from '@/lib/workspace'

export default async function Home() {
  if (isSupabaseConfigured && (await getUser())) redirect('/app')
  return (
    <main className="grid min-h-svh grid-rows-[1fr_auto] p-6">
      <div className="grid w-full max-w-lg justify-items-center gap-6 place-self-center text-center">
        <Logo className="text-2xl [&_svg]:size-8" />
        <h1 className="font-serif text-5xl leading-tight tracking-tight">Run your coaching business on the fast track.</h1>
        <p className="text-muted-foreground max-w-md">
          schedulefa.st is scheduling and business software for coaching and tutoring businesses: your team, booking pages, enrollment,
          payments, sessions and follow-ups in one place.
        </p>
        {isSupabaseConfigured ? (
          <div className="flex gap-2">
            <Button asChild size="lg"><Link href="/sign-up">Create your business</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/sign-in">Sign in</Link></Button>
          </div>
        ) : (
          <SetupNotice />
        )}
      </div>
      <SiteFooter className="pt-6" />
    </main>
  )
}
