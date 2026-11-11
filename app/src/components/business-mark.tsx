import { cn } from '@/lib/utils'

/** A business's logo (D-071), or its first letter on a coloured tile when it has none. Size it with className. */
export function BusinessMark({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  return logoUrl
    // eslint-disable-next-line @next/next/no-img-element -- public Storage URL; next/image would need remote config per project
    ? <img src={logoUrl} alt={`${name} logo`} className={cn('bg-background shrink-0 rounded-md border object-contain', className)} />
    : <div aria-hidden="true" className={cn('bg-primary text-primary-foreground flex shrink-0 items-center justify-center rounded-md font-bold', className)}>{name[0]?.toUpperCase()}</div>
}
