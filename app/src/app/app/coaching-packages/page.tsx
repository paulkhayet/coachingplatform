import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Package, Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCents } from '@/lib/booking/policy'
import { formatCredits } from '@/lib/coaching-packages'
import { canManageCoachingPackages } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { requirePackageAccess, type PackageSummary } from './data'

export const metadata: Metadata = { title: 'Coaching packages' }

export default async function CoachingPackagesPage() {
  const { business, membership } = await requirePackageAccess()
  const canManage = canManageCoachingPackages(membership)
  const supabase = await createClient()
  const { data, error } = await supabase.from('coaching_packages')
    .select('id, name, kind, term_weeks, credit_units, price_cents, archived_at')
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
        {canManage && !error && <Button asChild><Link href="/app/coaching-packages/new"><Plus /> New package</Link></Button>}
      </div>
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
        <div className="grid gap-3">
          {data.map((pkg) => (
            <Card key={pkg.id} className="py-0">
              <Link href={`/app/coaching-packages/${pkg.id}`} className="hover:bg-muted/50 focus-visible:ring-ring flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-5 py-4 focus-visible:ring-2 focus-visible:outline-none">
                <div className="min-w-40 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words">{pkg.name}</span>
                    <StatusBadge tone={pkg.archived_at ? 'neutral' : 'success'}>{pkg.archived_at ? 'Archived' : 'Available'}</StatusBadge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {pkg.kind === 'monthly' ? 'Monthly plan' : `${pkg.term_weeks} ${pkg.term_weeks === 1 ? 'week' : 'weeks'}`} · {formatCredits(pkg.credit_units)}{pkg.kind === 'monthly' ? ' per month' : ''}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">{formatCents(pkg.price_cents)}{pkg.kind === 'monthly' ? ' / month' : ''}</span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
