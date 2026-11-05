import { cn } from '@/lib/utils'

export function Progress({ value, className, segments }: { value: number; className?: string; segments?: { value: number; className: string }[] }) {
  return (
    <div className={cn('bg-muted relative flex h-2 w-full overflow-hidden rounded-full', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      {segments ? (
        segments.map((s, i) => <div key={i} className={cn('h-full transition-all', s.className)} style={{ width: `${Math.max(0, Math.min(100, s.value))}%` }} />)
      ) : (
        <div className="bg-primary h-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      )}
    </div>
  )
}
