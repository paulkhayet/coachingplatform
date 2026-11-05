import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { SetupNotice } from '@/components/setup-notice'
import { isSupabaseConfigured } from '@/lib/env'
import { getUser } from '@/lib/workspace'

export default async function Home() {
  if (isSupabaseConfigured && (await getUser())) redirect('/app')
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="grid w-full max-w-lg justify-items-center gap-6 text-center">
        <Logo className="text-2xl [&_svg]:size-8" />
        <h1 className="font-serif text-5xl leading-tight tracking-tight">Run your coaching business on the fast track.</h1>
        {isSupabaseConfigured ? (
          <div className="flex gap-2">
            <Button asChild size="lg"><Link href="/sign-up">Create your business</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/sign-in">Sign in</Link></Button>
          </div>
        ) : (
          <SetupNotice />
        )}
      </div>
    </main>
  )
}
