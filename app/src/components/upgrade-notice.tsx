import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SUBSCRIPTION_PATH } from '@/lib/settings-paths'

/** Explains a plan limit (D-072). Owners get a link to upgrade; everyone else is told who can. */
export function UpgradeNotice({ title, children, owner }: { title: string; children: React.ReactNode; owner: boolean }) {
  return (
    <div className="bg-primary/5 border-primary/20 flex flex-wrap items-center gap-4 rounded-xl border p-4">
      <Sparkles className="text-primary size-5 shrink-0" aria-hidden="true" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{children}{owner ? '' : ' Ask the business owner to upgrade.'}</p>
      </div>
      {owner && <Button asChild size="sm"><Link href={SUBSCRIPTION_PATH}>See plans</Link></Button>}
    </div>
  )
}
