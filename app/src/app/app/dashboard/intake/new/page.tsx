import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { US_TIME_ZONES } from '@/lib/validation'
import { requireDashboard } from '../../guard'
import { saveInquiry } from '../actions'
import { InquiryForm } from '../forms'

export const metadata: Metadata = { title: 'Add inquiry' }

export default async function NewInquiryPage() {
  const { business } = await requireDashboard('manager')
  return (
    <div className="grid max-w-2xl gap-4">
      <Link href="/app/dashboard/intake" className="text-muted-foreground text-sm hover:underline">← Intake</Link>
      <Card>
        <CardHeader>
          <CardTitle>Add an inquiry</CardTitle>
          <CardDescription>For families who called, emailed or were referred. You’ll be the one handling it until you pass it on.</CardDescription>
        </CardHeader>
        <CardContent>
          <InquiryForm action={saveInquiry.bind(null, business.id, null)} submitLabel="Add inquiry" timezones={US_TIME_ZONES.map((z) => z.value)}
            defaults={{ contactName: '', contactEmail: '', contactPhone: '', relationship: 'Parent', studentName: '', studentGrade: '', subjects: '', goals: '', availabilityNotes: '', timezone: business.timezone }} />
        </CardContent>
      </Card>
    </div>
  )
}
