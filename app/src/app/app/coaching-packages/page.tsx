import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Package, Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { formatCents } from '@/lib/booking/policy'
import { formatCredits } from '@/lib/coaching-packages'
import { canManageCoachingPackages } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { requirePackageAccess, type PackageSummary } from './data'
import { UpgradeNotice } from '@/components/upgrade-notice'
import { workspacePlan } from '@/lib/billing/server'

export const metadata: Metadata = { title: 'Coaching packages' }

function PackageCard({ pkg, canManage }: { pkg: PackageSummary; canManage: boolean }) {
  const monthly = pkg.kind === 'monthly'
  const action = canManage ? 'Edit package' : 'View package'
  const term = monthly ? 'Ongoing' : `${pkg.term_weeks} ${pkg.term_weeks === 1 ? 'week' : 'weeks'}`
  const payment = pkg.installment_count
    ? `Pay in full or ${pkg.installment_count} ${pkg.installment_cadence} payments`
    : 'Pay in full'
  const formats = pkg.session_formats.slice(0, 2)
  const remainingFormats = pkg.session_formats.length - formats.length
  const coachCount = pkg.eligible_coach_ids?.length

  return (
    <Card className="gap-4 pb-0">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-base leading-snug font-semibold break-words">{pkg.name}</h2>
          <StatusBadge tone={pkg.archived_at ? 'neutral' : 'success'}>{pkg.archived_at ? 'Archived' : 'Available'}</StatusBadge>
        </div>
        {pkg.description && <CardDescription className="line-clamp-2 break-words">{pkg.description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="min-h-13">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatCents(pkg.price_cents)}</span>
            {monthly && <span className="text-muted-foreground text-sm">/ month</span>}
          </div>
          {!monthly && <p className="text-muted-foreground text-sm">{payment}</p>}
        </div>
        <dl className="bg-muted/60 grid grid-cols-2 gap-3 rounded-lg px-3 py-2.5">
          <div>
            <dt className="text-muted-foreground text-xs">Term</dt>
            <dd className="mt-0.5 text-sm font-medium">{term}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">{monthly ? 'Monthly allowance' : 'Allowance'}</dt>
            <dd className="mt-0.5 text-sm font-medium">{formatCredits(pkg.credit_units)}</dd>
          </div>
        </dl>
        <div className="grid gap-1.5">
          <p className="text-muted-foreground text-xs">Session formats</p>
          <ul className="grid gap-1.5 text-sm">
            {formats.map((format, index) => (
              <li key={index} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <span className="min-w-0 break-words">{format.name}</span>
                <span className="text-muted-foreground tabular-nums">{format.durationMinutes} min · {formatCredits(format.creditUnits)}</span>
              </li>
            ))}
          </ul>
          {remainingFormats > 0 && <p className="text-muted-foreground text-xs">+{remainingFormats} more {remainingFormats === 1 ? 'format' : 'formats'}</p>}
        </div>
      </CardContent>
      <CardFooter className="mt-auto flex-wrap justify-between gap-2 border-t py-3">
        <span className="text-muted-foreground text-xs">{coachCount == null ? 'Any active coach' : `${coachCount} selected ${coachCount === 1 ? 'coach' : 'coaches'}`}</span>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/coaching-packages/${pkg.id}`} aria-label={`${action}: ${pkg.name}`}>
            {action} <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default async function CoachingPackagesPage() {
  const { business, membership } = await requirePackageAccess()
  const canManage = canManageCoachingPackages(membership)
  const { limits } = await workspacePlan(business.id)
  const supabase = await createClient()
  const { data, error } = await supabase.from('coaching_packages')
    .select('id, name, kind, term_weeks, credit_units, price_cents, archived_at, description, session_formats, installment_count, installment_cadence, eligible_coach_ids')
    .eq('business_id', business.id)
    .order('archived_at', { ascending: false, nullsFirst: true })
    .order('name')
    .returns<PackageSummary[]>()

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coaching packages</h1>
          <p className="text-muted-foreground mt-1 text-sm">Set up the bundles and monthly plans your business offers.</p>
        </div>
        {canManage && !error && limits.clients && <Button asChild><Link href="/app/coaching-packages/new"><Plus /> New package</Link></Button>}
      </div>
      {!limits.clients && <UpgradeNotice title="Coaching packages are on the Solo and Team plans" owner={membership.role === 'owner'}>Sell bundles and monthly plans, then track each client’s credits.</UpgradeNotice>}
      {error ? (
        <Alert variant="destructive"><AlertDescription>Couldn’t load coaching packages. Refresh the page to try again.</AlertDescription></Alert>
      ) : !data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <div className="bg-accent text-accent-foreground grid size-10 place-items-center rounded-lg"><Package className="size-5" aria-hidden="true" /></div>
            <div>
              <h2 className="font-medium">No packages yet</h2>
              <p className="text-muted-foreground mt-1 text-sm">{canManage ? 'Create a package with a term, session allowance, and price you can reuse for clients.' : 'Packages will appear here once they’re set up.'}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))] gap-4">
          {data.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} canManage={canManage} />)}
        </div>
      )}
    </div>
  )
}
