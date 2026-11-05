import { Link, useParams } from 'react-router'
import { ArrowRight, Clock, MessageSquareText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { useDB } from '@/lib/store'
import { money } from '@/lib/format'
import { etColor, LocationIcon } from '@/pages/staff/BookingPages'
import NotFound from '@/pages/NotFound'
import { cn } from '@/lib/utils'

export function BusinessMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return <div className={cn('bg-primary text-primary-foreground flex items-center justify-center font-bold', size === 'lg' ? 'size-14 rounded-2xl text-xl' : 'size-10 rounded-lg')}>W</div>
}

export default function Profile() {
  const { slug } = useParams()
  const db = useDB()
  if (slug !== db.business.slug) return <NotFound />
  const pages = db.eventTypes.filter((e) => e.active)
  return (
    <div className="bg-muted/30 min-h-svh">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-2 flex justify-end"><ThemeToggle /></div>
        <div className="mb-10 grid justify-items-center gap-3 text-center">
          <BusinessMark size="lg" />
          <h1 className="font-serif text-4xl tracking-tight">{db.business.name}</h1>
          <p className="text-muted-foreground max-w-md">Coaching for middle school, high school and college students. Pick a time that works for you.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {pages.map((et) => (
            <Link key={et.id} to={`/b/${slug}/${et.slug}`} className="group">
              <Card className="hover:border-primary/60 h-full gap-3 overflow-hidden pt-0 transition-colors">
                <div className={cn('h-1.5', etColor[et.color])} />
                <div className="grid gap-2 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{et.name}</span>
                    <Badge variant={et.priceCents ? 'accent' : 'secondary'}>{et.priceCents ? money(et.priceCents) : 'Free'}</Badge>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><Clock className="size-3.5" /> {et.minutes} min</span>
                    <span className="flex items-center gap-1"><LocationIcon l={et.location} className="size-3.5" /> {et.location === 'zoom' ? 'Zoom' : et.location === 'phone' ? 'Phone' : 'In person'}</span>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-sm">{et.description}</p>
                  <span className="text-primary flex items-center gap-1 text-sm font-medium">Choose a time <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
        <Link to={`/b/${slug}/inquiry`} className="hover:bg-card mt-4 flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm transition-colors">
          <MessageSquareText className="text-muted-foreground size-5" />
          <span className="flex-1"><span className="font-medium">Not ready to book?</span> <span className="text-muted-foreground">Send us a note and we’ll match you with a coach.</span></span>
          <ArrowRight className="text-muted-foreground size-4" />
        </Link>
        <div className="text-muted-foreground mt-10 flex justify-center text-xs">Powered by&nbsp;<Logo className="text-xs [&_svg]:size-3.5" /></div>
      </div>
    </div>
  )
}
