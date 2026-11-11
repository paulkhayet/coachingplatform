import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/brand'
import { SiteFooter } from '@/components/site-footer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ContactForm } from './form'

export const metadata: Metadata = { title: 'Contact us' }

/** Sales enquiries, e.g. the Corporate plan on the home page (D-067). */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const plan = (await searchParams).plan ?? 'corporate'
  const corporate = plan === 'corporate'
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center p-6">
      <div className="grid w-full max-w-lg justify-items-center gap-6">
        <Link href="/" aria-label="schedulefa.st home"><Logo className="text-xl [&_svg]:size-7" /></Link>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">{corporate ? 'Talk to us about Corporate' : 'Contact us'}</CardTitle>
            <CardDescription>
              {corporate ? 'Tell us a little about your organization and we’ll get back to you about pricing and getting your team set up.' : 'Send us a message and we’ll get back to you.'}
            </CardDescription>
          </CardHeader>
          <CardContent><ContactForm plan={plan} /></CardContent>
        </Card>
        <SiteFooter />
      </div>
    </main>
  )
}
