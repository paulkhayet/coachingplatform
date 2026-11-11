import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { coachOptions } from '@/app/app/booking-pages/hosts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { canManageCoachingPackages } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { savePackage, setPackageArchived } from '../actions'
import { requirePackageAccess, type PackageDetails } from '../data'
import { PackageArchiveForm, PackageForm } from '../form'

export const metadata: Metadata = { title: 'Coaching package' }

const statusMessage: Record<string, string> = {
  saved: 'Package saved.',
  archived: 'Package archived.',
  restored: 'Package restored.',
}

export default async function CoachingPackagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { business, membership } = await requirePackageAccess()
  const [{ id }, { status }] = await Promise.all([params, searchParams])
  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: pkg, error } = await supabase.from('coaching_packages').select('*')
    .eq('business_id', business.id).eq('id', id).maybeSingle<PackageDetails>()

  if (error) return (
    <div className="grid max-w-2xl gap-4">
      <Link href="/app/coaching-packages" className="text-muted-foreground text-sm hover:underline">← Coaching packages</Link>
      <Alert variant="destructive"><AlertDescription>Couldn’t load the package. Refresh the page to try again.</AlertDescription></Alert>
    </div>
  )
  if (!pkg) notFound()

  const canManage = canManageCoachingPackages(membership)
  const archived = Boolean(pkg.archived_at)
  const message = status && Object.hasOwn(statusMessage, status) ? statusMessage[status] : null

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <Link href="/app/coaching-packages" className="text-muted-foreground text-sm hover:underline">← Coaching packages</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{pkg.name}</h1>
          <StatusBadge tone={archived ? 'neutral' : 'success'}>{archived ? 'Archived' : 'Available'}</StatusBadge>
        </div>
        {!canManage && <p className="text-muted-foreground mt-2 text-sm">An owner or administrator with financial permission can edit these terms.</p>}
      </div>
      {message && <Alert variant="success"><AlertDescription>{message}</AlertDescription></Alert>}
      <PackageForm action={savePackage.bind(null, business.id, id)} pkg={pkg} coaches={await coachOptions(business.id)} readOnly={!canManage} />
      {canManage && <Card>
        <CardHeader>
          <CardTitle>Package availability</CardTitle>
          <CardDescription>{archived ? 'Restore this package to make it available again.' : 'Archive this package to retire it from your available offers and keep its record.'}</CardDescription>
        </CardHeader>
        <CardContent><PackageArchiveForm action={setPackageArchived.bind(null, business.id, id, !archived)} archived={archived} /></CardContent>
      </Card>}
    </div>
  )
}
