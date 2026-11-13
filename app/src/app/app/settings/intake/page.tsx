import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopyButton } from '@/components/copy-button'
import { UpgradeNotice } from '@/components/upgrade-notice'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { BookingQuestion } from '@/db/schema'
import { formatPlanPrice } from '@/lib/billing/plans'
import { parseQuestions } from '@/lib/booking/questions'
import { siteUrl } from '@/lib/env'
import { dashboardAccess, loadTeam } from '@/lib/insights/server'
import { roleLabel } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { saveIntakeSettings } from './actions'
import { IntakeSettingsForm } from './form'

export const metadata: Metadata = { title: 'Intake form' }

export default async function IntakeSettingsPage() {
  const access = await dashboardAccess()
  if (!access.manager) notFound()
  const { business } = access
  if (!access.enabled) {
    return (
      <div className="grid max-w-3xl gap-5">
        <UpgradeNotice title="The inquiry form is part of the team dashboard" owner={access.owner}>
          It’s on the Team plan: {formatPlanPrice('team', 'year')}.
        </UpgradeNotice>
      </div>
    )
  }
  const supabase = await createClient()
  const [{ data }, team] = await Promise.all([
    supabase.from('intake_settings').select('enabled, intro, questions, notify_membership_ids').eq('business_id', business.id)
      .maybeSingle<{ enabled: boolean; intro: string | null; questions: BookingQuestion[]; notify_membership_ids: string[] | null }>(),
    loadTeam(business.id),
  ])
  const url = `${siteUrl}/b/${business.slug}/inquire`
  return (
    <div className="grid max-w-3xl gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Inquiry form</CardTitle>
          <CardDescription>A public form for families who want coaching. What they send appears in <Link href="/app/dashboard/intake" className="text-primary hover:underline">Intake</Link>.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {data?.enabled && (
            <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Share this link, or find it on your public page.</p>
                <a href={url} target="_blank" rel="noreferrer" className="text-primary text-sm break-all hover:underline">{url.replace(/^https?:\/\//, '')}</a>
              </div>
              <CopyButton text={url} />
            </div>
          )}
          <IntakeSettingsForm save={saveIntakeSettings.bind(null, business.id)}
            initial={{ enabled: data?.enabled ?? false, intro: data?.intro ?? '', questions: parseQuestions(data?.questions ?? []), notify: data?.notify_membership_ids ?? null }}
            staff={team.filter((m) => m.role !== 'coach').map((m) => ({ id: m.id, name: m.name, role: roleLabel[m.role] }))} />
        </CardContent>
      </Card>
    </div>
  )
}
