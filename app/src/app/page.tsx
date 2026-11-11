import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/landing/landing-page'
import { isSupabaseConfigured } from '@/lib/env'
import { getUser } from '@/lib/workspace'

export const metadata: Metadata = {
  title: { absolute: 'schedulefa.st — Streamline your entire coaching business.' },
  description: 'Booking pages, Google Calendar, Zoom links, payments and reminders for coaching and tutoring businesses. Free to start.',
  alternates: { canonical: 'https://www.schedulefa.st/' },
  openGraph: {
    title: 'schedulefa.st — Streamline your entire coaching business.',
    description: 'Give families one link to book, pay and join the call. Booking pages, calendars, Zoom links, payments and reminders in one place.',
    url: 'https://www.schedulefa.st/',
    siteName: 'schedulefa.st',
    type: 'website',
  },
}

/** Signed-in people go straight to their workspace; everyone else sees the marketing page. */
export default async function Home() {
  if (isSupabaseConfigured && (await getUser())) redirect('/app')
  return <LandingPage />
}
