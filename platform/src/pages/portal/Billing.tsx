import { Navigate } from 'react-router'
import { CreditCard } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { Empty } from '@/components/page'
import { useDB, useViewer, actions } from '@/lib/store'
import { date, money } from '@/lib/format'
import { run } from '@/components/run'
import { portalContext } from './context'

export default function PortalBilling() {
  const db = useDB()
  const ctx = portalContext(db, useViewer())
  if (!ctx.perms.billing) return <Navigate to="/portal" replace />
  const purchases = db.purchases.filter((p) => p.studentId === ctx.student.id)
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground text-sm">Payments go directly to {db.business.name} through Stripe.</p>
      </div>
      {purchases.length ? purchases.map((p) => {
        const offer = db.offers.find((o) => o.purchaseId === p.id)
        return (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>
                {p.kind === 'monthly' ? `${money(p.priceCents)} per month` : `${money(p.priceCents)} total`}
                {offer?.signedAt && ` · agreement signed ${date(offer.signedAt)}`}
                {p.historical && ' · paid before moving to online billing'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {p.installments.map((i) => {
                const due = i.status !== 'paid' && new Date(i.dueDate) <= new Date(Date.now() + 14 * 86400000)
                return (
                  <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
                    <span className="flex-1">{p.kind === 'monthly' ? 'Month starting' : 'Due'} {date(i.dueDate)}</span>
                    <span className="tabular-nums">{money(i.amountCents)}</span>
                    <StatusBadge tone={i.status === 'paid' ? 'success' : i.status === 'failed' ? 'danger' : 'neutral'}>{i.status === 'paid' ? 'Paid' : i.status === 'failed' ? 'Payment failed' : 'Upcoming'}</StatusBadge>
                    {due && <Button size="sm" onClick={() => run(actions.recordPayment(p.id, i.id, 'paid', ctx.student.id))}><CreditCard /> {i.status === 'failed' ? 'Update card and pay' : 'Pay now'}</Button>}
                  </div>
                )
              })}
              <p className="text-muted-foreground text-xs">Payments fund session credits as they arrive. Demo payments use Stripe test mode.</p>
            </CardContent>
          </Card>
        )
      }) : <Empty title="No billing yet" />}
    </div>
  )
}
