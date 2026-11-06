import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/brand'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/workspace'
import { OnboardingForm } from './form'

export const metadata: Metadata = { title: 'Set up your business' }

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ another?: string }> }) {
  // ?another=1: someone who already runs or works for a business is creating another one (D-057).
  const another = (await searchParams).another === '1'
  const user = await getUser()
  if (!user) redirect('/sign-in?next=/onboarding')
  const supabase = await createClient()
  const { count } = await supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active')
  if (count && !another) redirect('/app')
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center p-6">
      <div className="grid w-full max-w-md justify-items-center gap-6">
        <Logo className="text-xl [&_svg]:size-7" />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">{another ? 'Create another business' : 'Set up your coaching business'}</CardTitle>
            <CardDescription>{another ? 'It gets its own team, clients and settings. Your availability and calendar are shared, so you can’t be double-booked.' : 'You’ll be the owner. You can invite your team afterwards.'}</CardDescription>
          </CardHeader>
          <CardContent><OnboardingForm /></CardContent>
        </Card>
      </div>
    </main>
  )
}
