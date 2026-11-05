import { cn } from '@/lib/utils'

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-7', className)} aria-hidden="true">
      <rect width="64" height="64" rx="15" className="fill-foreground" />
      <path className="fill-background" d="M9 18h9l14 14-14 14H9l14-14z" />
      <path fill="#6e87ff" d="M29 18h9l14 14-14 14h-9l14-14z" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[17px] font-bold tracking-[-0.04em]', className)}>
      <Mark className="size-6" />
      <span>
        schedule<span className="text-primary">fa.st</span>
      </span>
    </span>
  )
}
