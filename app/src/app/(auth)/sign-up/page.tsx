import type { Metadata } from 'next'
import { findInvitation } from '@/lib/team/invitations'
import { findFamilyInvite } from '@/lib/family/invitations'
import { safeNext } from '@/lib/validation'
import { SignUpForm } from '../forms'

export const metadata: Metadata = { title: 'Create your account' }

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const raw = (await searchParams).next
  const next = raw ? safeNext(raw) : undefined
  // Arriving from an invitation link: fill in the invited email and say which business they'll join.
  const token = next?.match(/^\/join\/([A-Za-z0-9_-]+)$/)?.[1]
  const invite = token ? await findInvitation(token) : null
  if (invite?.state === 'open') return <SignUpForm next={next} invite={{ businessName: invite.businessName, email: invite.email }} />
  // A family portal invitation (D-073): a parent or guardian, not someone setting up a business.
  const familyToken = next?.match(/^\/family\/join\/([A-Za-z0-9_-]+)$/)?.[1]
  const family = familyToken ? await findFamilyInvite(familyToken) : null
  if (family?.state === 'open') {
    return <SignUpForm next={next} invite={{ businessName: family.businessName, email: family.email, description: `Then you’ll see ${family.clientName}’s coaching with ${family.businessName}. Free for families.` }} />
  }
  return <SignUpForm next={next} />
}
