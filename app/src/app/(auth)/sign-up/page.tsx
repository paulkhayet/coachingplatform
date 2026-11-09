import type { Metadata } from 'next'
import { findInvitation } from '@/lib/team/invitations'
import { safeNext } from '@/lib/validation'
import { SignUpForm } from '../forms'

export const metadata: Metadata = { title: 'Create your account' }

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const raw = (await searchParams).next
  const next = raw ? safeNext(raw) : undefined
  // Arriving from an invitation link: fill in the invited email and say which business they'll join.
  const token = next?.match(/^\/join\/([A-Za-z0-9_-]+)$/)?.[1]
  const invite = token ? await findInvitation(token) : null
  return <SignUpForm next={next} invite={invite?.state === 'open' ? { businessName: invite.businessName, email: invite.email } : undefined} />
}
