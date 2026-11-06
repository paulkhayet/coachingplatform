import type { Metadata } from 'next'
import { SignInForm } from '../forms'

export const metadata: Metadata = { title: 'Sign in' }

const notices: Record<string, string> = {
  link: 'That link has expired, was already used, or was opened in a different browser. Sign in below, or request a new link.',
  oauth: 'Google sign-in didn’t finish. Try again, or sign in with your email.',
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return <SignInForm next={next} notice={error ? notices[error] : undefined} />
}
