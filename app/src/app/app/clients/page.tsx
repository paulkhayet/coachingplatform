import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ContactRound, Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { coachOptions } from '@/app/app/booking-pages/hosts'
import { canManageClients } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { UpgradeNotice } from '@/components/upgrade-notice'
import { workspacePlan } from '@/lib/billing/server'
import type { ClientRow } from './data'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const { business, membership } = await requireWorkspace()
  const manager = canManageClients(membership.role)
  const supabase = await createClient()
  const [{ data, error }, coaches] = await Promise.all([
    supabase.from('coaching_clients').select('id, name, email, coach_membership_id')
      .eq('business_id', business.id).order('name').returns<ClientRow[]>(),
    coachOptions(business.id),
  ])
  const coachNames = new Map(coaches.map((coach) => [coach.id, coach.name]))
  const { limits } = await workspacePlan(business.id)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1 text-sm">{manager ? 'Manage client records, coaching packages, and credit balances.' : 'View your assigned clients and their credit balances.'}</p>
        </div>
        {manager && limits.clients && <Button asChild><Link href="/app/clients/new"><Plus /> New client</Link></Button>}
      </div>
      {!limits.clients && <UpgradeNotice title="Clients are on the Solo and Team plans" owner={membership.role === 'owner'}>Keep client and guardian records, packages, credits and files in one place.</UpgradeNotice>}
      {error ? (
        <Alert variant="destructive"><AlertDescription>Couldn’t load clients. Refresh the page to try again.</AlertDescription></Alert>
      ) : !data?.length ? (
        <Card>
          <CardContent className="grid justify-items-start gap-3">
            <div className="bg-accent text-accent-foreground grid size-10 place-items-center rounded-lg"><ContactRound className="size-5" aria-hidden="true" /></div>
            <div>
              <h2 className="font-medium">{manager ? 'No clients yet' : 'No assigned clients yet'}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{manager ? 'Add a client to set up their contacts and coaching package.' : 'Clients assigned to you will appear here.'}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))] gap-4">
          {data.map((client) => (
            <Card key={client.id} className="gap-4 pb-0">
              <CardHeader className="gap-2">
                <h2 className="text-base leading-snug font-semibold break-words">{client.name}</h2>
                {client.email && <CardDescription className="break-all">{client.email}</CardDescription>}
              </CardHeader>
              <CardContent>
                <dl className="bg-muted/60 rounded-lg px-3 py-2.5">
                  <dt className="text-muted-foreground text-xs">Assigned coach</dt>
                  <dd className="mt-0.5 text-sm font-medium break-words">{client.coach_membership_id ? coachNames.get(client.coach_membership_id) ?? 'Unavailable coach' : 'Unassigned'}</dd>
                </dl>
              </CardContent>
              <CardFooter className="mt-auto justify-end border-t py-3">
                <Button asChild variant="outline" size="sm"><Link href={`/app/clients/${client.id}`} aria-label={`View client: ${client.name}`}>View client <ArrowRight aria-hidden="true" /></Link></Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
