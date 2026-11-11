import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{found.business.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Choose what you’d like to book.</p>
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
