import { Progress } from '@/components/ui/progress'
import type { PurchaseBalance } from '@/lib/credits'
import { num, money, date } from '@/lib/format'

export function CreditSummary({ bal, showMoney }: { bal: PurchaseBalance; showMoney: boolean }) {
  const P = bal.purchased || 1
  const pct = (n: number) => (n / P) * 100
  return (
    <div className="grid gap-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium">{bal.purchase.kind === 'monthly' ? 'This cycle' : 'Program'} credits</span>
          <span className="text-muted-foreground text-xs">{num(bal.purchased)} purchased · {num(bal.funded)} funded</span>
        </div>
        <Progress
          value={0}
          segments={[
            { value: pct(bal.consumed), className: 'bg-foreground/80' },
            { value: pct(bal.forfeited), className: 'bg-destructive/70' },
            { value: pct(bal.reservedFunded), className: 'bg-primary' },
            { value: pct(bal.reservedUnfunded), className: 'bg-warning' },
            { value: pct(bal.usableFunded), className: 'bg-success/70' },
          ]}
          className="h-2.5"
        />
        <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Legend c="bg-foreground/80" l={`Used ${num(bal.consumed)}`} />
          {bal.forfeited > 0 && <Legend c="bg-destructive/70" l={`Forfeited ${num(bal.forfeited)}`} />}
          <Legend c="bg-primary" l={`Booked, funded ${num(bal.reservedFunded)}`} />
          {bal.reservedUnfunded > 0 && <Legend c="bg-warning" l={`Booked, awaiting payment ${num(bal.reservedUnfunded)}`} />}
          <Legend c="bg-success/70" l={`Ready to book ${num(bal.usableFunded)}`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Mini k="Unbooked entitlement" v={num(Math.max(0, bal.remainingEntitlement))} />
        <Mini k="Funded and free" v={num(bal.usableFunded)} />
        <Mini k={bal.purchase.kind === 'monthly' ? 'Cycle ends' : 'Program ends'} v={date(bal.purchase.kind === 'monthly' ? bal.current.end.toISOString() : bal.purchase.endDate)} />
        {showMoney ? <Mini k="Paid" v={`${money(bal.paidCents)} of ${money(bal.totalCents)}`} /> : <Mini k="Makeups" v={bal.makeup ? num(bal.makeup.available) : '0'} />}
      </div>
      {bal.makeup && bal.makeup.available > 0 && (
        <div className="bg-accent/60 rounded-md px-3 py-2 text-xs">
          {num(bal.makeup.available)} makeup credit{bal.makeup.available === 1 ? '' : 's'} preserved from timely cancellations · bookable until {date(bal.makeup.deadline.toISOString())}
        </div>
      )}
    </div>
  )
}
const Legend = ({ c, l }: { c: string; l: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={`size-2 rounded-full ${c}`} />
    {l}
  </span>
)
const Mini = ({ k, v }: { k: string; v: string }) => (
  <div className="bg-muted/50 rounded-md px-3 py-2">
    <div className="text-muted-foreground text-xs">{k}</div>
    <div className="font-medium tabular-nums">{v}</div>
  </div>
)
