import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { findFamilyInvite } from '@/lib/family/invitations'
import { getUser } from '@/lib/workspace'
import { signOut } from '../../../actions'
import { FamilyJoinButton } from '../form'

export const metadata: Metadata = { title: 'Family portal invitation', robots: { index: false } }

function Notice({ title, children, signedIn }: { title: string; children: React.ReactNode; signedIn: boolean }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full"><Link href={signedIn ? '/family' : '/sign-in'}>{signedIn ? 'Go to your family portal' : 'Sign in'}</Link></Button>
      </CardContent>
    </Card>
  )
}

/** Where a family portal invitation lands (D-073). Accepting needs the invited email, signed in. */
export default async function FamilyJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [invite, user] = await Promise.all([findFamilyInvite(token), getUser()])
  const signedIn = Boolean(user)
  if (!invite) return <Notice title="This link doesn’t work" signedIn={signedIn}>It may have been used already, turned off, or replaced by a newer invitation. Ask the coaching business to send a new one.</Notice>
  if (invite.state === 'expired') return <Notice title="This invitation has expired" signedIn={signedIn}>Ask {invite.businessName} to send you a new link.</Notice>

  const here = `/family/join/${token}`
  const matches = user?.email?.toLowerCase() === invite.email
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">{invite.clientName}’s coaching with {invite.businessName}</CardTitle>
        <CardDescription>
          {invite.inviterName ? `${invite.inviterName} invited you` : 'You’re invited'} to the family portal, where you can see sessions, meeting links and credits.
          The invitation is for <strong className="text-foreground">{invite.email}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!user ? (
          <>
            <Button asChild><Link href={`/sign-up?next=${encodeURIComponent(here)}`}>Create a free account</Link></Button>
            <Button asChild variant="outline"><Link href={`/sign-in?next=${encodeURIComponent(here)}`}>I already have an account</Link></Button>
            <p className="text-muted-foreground text-xs">Use {invite.email}. Families don’t pay anything to use the portal.</p>
          </>
        ) : matches ? (
          <FamilyJoinButton token={token} label="Open the family portal" />
        ) : (
          <>
            <p className="text-sm">You’re signed in as <strong>{user.email}</strong>. Sign out, then sign in or create an account with {invite.email}.</p>
            <form action={signOut}>
              <input type="hidden" name="next" value={here} />
              <Button type="submit" variant="outline" className="w-full">Sign out</Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  )
}
