import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { coachOptions } from '@/app/app/booking-pages/hosts'
import { canManageCoachingPackages } from '@/lib/roles'
import { savePackage } from '../actions'
import { requirePackageAccess } from '../data'
import { PackageForm } from '../form'

export const metadata: Metadata = { title: 'New coaching package' }

export default async function NewCoachingPackagePage() {
  const { business, membership } = await requirePackageAccess()
  if (!canManageCoachingPackages(membership)) redirect('/app/coaching-packages')

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <Link href="/app/coaching-packages" className="text-muted-foreground text-sm hover:underline">← Coaching packages</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New coaching package</h1>
      </div>
      <PackageForm action={savePackage.bind(null, business.id, null)} coaches={await coachOptions(business.id)} />
    </div>
  )
}
