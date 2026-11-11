import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, Globe, Mail } from 'lucide-react'
import { BusinessMark } from '@/components/business-mark'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { businessLogoUrl } from '@/lib/business-logo'
import { listPublicPages } from '@/lib/booking/server'

export async function generateMetadata({ params }: { params: Promise<{ business: string }> }): Promise<Metadata> {
  const found = await listPublicPages((await params).business)
  return { title: found ? `Book with ${found.business.name}` : 'Not found' }
}

export default async function BusinessBookingIndex({ params }: { params: Promise<{ business: string }> }) {
  const found = await listPublicPages((await params).business)
  if (!found) notFound()
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="flex items-start gap-4">
        <BusinessMark name={found.business.name} logoUrl={businessLogoUrl(found.business.logoPath)} className="size-16 rounded-lg text-2xl" />
        <div className="grid min-w-0 gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{found.business.name}</h1>
          {found.business.about && <p className="text-sm whitespace-pre-line">{found.business.about}</p>}
          {(found.business.websiteUrl || found.business.contactEmail) && (
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {found.business.websiteUrl && (
                <a href={found.business.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                  <Globe className="size-3.5" /> {found.business.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
              {found.business.contactEmail && (
                <a href={`mailto:${found.business.contactEmail}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="size-3.5" /> {found.business.contactEmail}</a>
              )}
            </div>
          )}
          <p className="text-muted-foreground mt-1 text-sm">Choose what you’d like to book.</p>
        </div>
      </div>
      {found.pages.length === 0 ? (
        <p className="text-muted-foreground text-sm">There’s nothing to book here right now.</p>
      ) : (
        <div className="grid gap-3">
          {found.pages.map((p) => (
            <Link key={p.slug} href={`/b/${found.business.slug}/${p.slug}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle>{p.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5"><Clock className="size-3.5" /> {p.durationMinutes} minutes</CardDescription>
                </CardHeader>
                {p.description && <CardContent className="text-muted-foreground text-sm">{p.description}</CardContent>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
