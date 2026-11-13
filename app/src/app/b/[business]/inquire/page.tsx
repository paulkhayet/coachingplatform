import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BusinessMark } from '@/components/business-mark'
import { Card, CardContent } from '@/components/ui/card'
import { workspacePlan } from '@/lib/billing/server'
import { parseQuestions } from '@/lib/booking/questions'
import { businessLogoUrl } from '@/lib/business-logo'
import { publicIntake } from '@/lib/intake/server'
import { US_TIME_ZONES } from '@/lib/validation'
import { sendInquiry } from './actions'
import { InquiryPublicForm } from './form'

export async function generateMetadata({ params }: { params: Promise<{ business: string }> }): Promise<Metadata> {
  const found = await publicIntake((await params).business)
  return { title: found ? `Ask ${found.business.name} about coaching` : 'Not found' }
}

/** The public inquiry form (D-074): families tell a business what they're looking for, without an account. */
export default async function InquirePage({ params }: { params: Promise<{ business: string }> }) {
  const found = await publicIntake((await params).business)
  if (!found) notFound()
  const { business, settings } = found
  const open = Boolean(settings?.enabled) && (await workspacePlan(business.id)).limits.teamDashboard
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="flex items-center gap-4">
        <BusinessMark name={business.name} logoUrl={businessLogoUrl(business.logoPath)} className="size-14 rounded-lg text-xl" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">Ask about coaching</h1>
          <p className="text-muted-foreground text-sm break-words">{business.name}</p>
        </div>
      </div>
      {open ? (
        <>
          {settings?.intro && <p className="text-sm whitespace-pre-line">{settings.intro}</p>}
          <Card>
            <CardContent>
              <InquiryPublicForm action={sendInquiry.bind(null, business.slug)} businessName={business.name} questions={parseQuestions(settings?.questions ?? [])}
                timezones={US_TIME_ZONES.map((z) => ({ value: z.value, label: z.label }))} defaultTimezone={business.timezone} />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="grid gap-2 text-sm">
            <p className="font-medium">This business isn’t taking inquiries online.</p>
            {business.contactEmail
              ? <p className="text-muted-foreground">You can email them at <a href={`mailto:${business.contactEmail}`} className="text-primary hover:underline">{business.contactEmail}</a>.</p>
              : <p className="text-muted-foreground">Get in touch with them directly.</p>}
            <Link href={`/b/${business.slug}`} className="text-primary justify-self-start hover:underline">See what you can book with {business.name}</Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
