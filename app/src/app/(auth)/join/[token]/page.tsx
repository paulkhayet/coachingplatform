import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { findInvitation } from '@/lib/team/invitations'
import { roleLabel } from '@/lib/roles'
import { getUser } from '@/lib/workspace'
import { signOut } from '../../actions'
import { JoinButton } from '../form'

export const metadata: Metadata = { title: 'Join a business', robots: { index: false } }

function Notice({ title, children, signedIn }: { title: string; children: React.ReactNode; signedIn: boolean }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full"><Link href={signedIn ? '/app' : '/sign-in'}>{signedIn ? 'Go to schedulefa.st' : 'Sign in'}</Link></Button>
      </CardContent>
    </Card>
  )
}

/** Where an invitation link lands (D-060). Anyone can open it; joining needs the invited email, signed in. */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [invite, user] = await Promise.all([findInvitation(token), getUser()])
  const signedIn = Boolean(user)
  if (!invite) return <Notice title="This link doesn’t work" signedIn={signedIn}>It may have been cancelled, or replaced by a newer invitation. Ask the person who invited you to send a new one.</Notice>
  if (invite.state === 'accepted') return <Notice title="Invitation already used" signedIn={signedIn}>This invitation to {invite.businessName} has already been accepted. Sign in to get to it.</Notice>
  if (invite.state === 'expired') return <Notice title="This invitation has expired" signedIn={signedIn}>Ask {invite.inviterName ?? 'the person who invited you'} to send you a new link to {invite.businessName}.</Notice>

  const here = `/join/${token}`
  const role = roleLabel[invite.role].toLowerCase()
  const who = invite.inviterName ? `${invite.inviterName} invited you` : 'You’re invited'
  const matches = user?.email?.toLowerCase() === invite.email
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Join {invite.businessName}</CardTitle>
        <CardDescription>{who} to join as {role === 'administrator' ? 'an' : 'a'} {role}. The invitation is for <strong className="text-foreground">{invite.email}</strong>.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!user ? (
          <>
            <Button asChild><Link href={`/sign-up?next=${encodeURIComponent(here)}`}>Create a free account</Link></Button>
            <Button asChild variant="outline"><Link href={`/sign-in?next=${encodeURIComponent(here)}`}>I already have an account</Link></Button>
            <p className="text-muted-foreground text-xs">Use {invite.email}. Already work for another business on schedulefa.st? Sign in; you’ll switch between your businesses from one account.</p>
          </>
        ) : matches ? (
          <>
            <JoinButton token={token} businessName={invite.businessName} />
            <p className="text-muted-foreground text-xs">Your hours, calendar and any other businesses stay as they are. You can set hours just for {invite.businessName} afterwards.</p>
          </>
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
