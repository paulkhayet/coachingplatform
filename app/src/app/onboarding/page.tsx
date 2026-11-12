import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { familyLinks } from '@/lib/family/access'
import { openFamilyInvitesFor } from '@/lib/family/invitations'
import { FamilyJoinButton } from '../(auth)/family/join/form'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/workspace'
import { openInvitationsFor } from '@/lib/team/invitations'
import { roleLabel } from '@/lib/roles'
import { JoinButton } from '../(auth)/join/form'
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
  // D-060: someone invited by email who signed up without the link can still join from here.
  const confirmedEmail = user.email_confirmed_at && user.email ? user.email : null
  const [invites, familyInvites, links] = await Promise.all([
    confirmedEmail ? openInvitationsFor(confirmedEmail) : [],
    confirmedEmail ? openFamilyInvitesFor(confirmedEmail) : [],
    familyLinks(user.id),
  ])
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center p-6">
      <div className="grid w-full max-w-md justify-items-center gap-6">
        <Logo className="text-xl [&_svg]:size-7" />
        {(familyInvites.length > 0 || links.length > 0) && (
          // D-073: parents and guardians usually just want their family portal, not a business.
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-xl">Your family portal</CardTitle>
              <CardDescription>See sessions, meeting links and credits for the students you follow.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {familyInvites.map((inv) => (
                <div key={inv.id} className="grid gap-2">
                  <p className="text-sm"><strong>{inv.clientName}</strong> <span className="text-muted-foreground">with {inv.businessName}</span></p>
                  <FamilyJoinButton accessId={inv.id} label="Accept and open the portal" />
                </div>
              ))}
              {links.length > 0 && <Button asChild variant="outline"><Link href="/family">Go to your family portal</Link></Button>}
            </CardContent>
          </Card>
        )}
        {invites.length > 0 && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-xl">You’ve been invited</CardTitle>
              <CardDescription>Join a business that invited {user.email}. You can still create your own as well.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {invites.map((inv) => (
                <div key={inv.id} className="grid gap-2">
                  <p className="text-sm"><strong>{inv.businessName}</strong> <span className="text-muted-foreground">as {roleLabel[inv.role].toLowerCase()}</span></p>
                  <JoinButton invitationId={inv.id} businessName={inv.businessName} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
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
