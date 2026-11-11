import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { coachOptions } from '@/app/app/booking-pages/hosts'
import { Card, CardContent } from '@/components/ui/card'
import { canManageClients } from '@/lib/roles'
import { requireWorkspace } from '@/lib/workspace'
import { saveClient } from '../actions'
import { ClientForm } from '../forms'

export const metadata: Metadata = { title: 'New client' }

export default async function NewClientPage() {
  const { business, membership } = await requireWorkspace()
  if (!canManageClients(membership.role)) redirect('/app/clients')

  return (
    <div className="grid max-w-xl gap-5">
      <div>
        <Link href="/app/clients" className="text-muted-foreground text-sm hover:underline">← Clients</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New client</h1>
        <p className="text-muted-foreground mt-1 text-sm">Add the person receiving coaching. You can add guardian contacts and a package after saving.</p>
      </div>
      <Card><CardContent><ClientForm action={saveClient.bind(null, business.id, null)} coaches={await coachOptions(business.id)} /></CardContent></Card>
    </div>
  )
}
