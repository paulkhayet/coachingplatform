import type { Metadata } from 'next'
import { SignInForm } from '../forms'

export const metadata: Metadata = { title: 'Sign in' }

const notices: Record<string, string> = {
  link: 'That sign-in link has expired or was already used. Sign in with your password, or request a new link.',
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return <SignInForm next={next} notice={error ? notices[error] : undefined} />
}
