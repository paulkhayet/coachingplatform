import { cn } from '@/lib/utils'

const tones = ['bg-blue-100 text-blue-800', 'bg-amber-100 text-amber-800', 'bg-emerald-100 text-emerald-800', 'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800', 'bg-cyan-100 text-cyan-800']

export function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (
    <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold dark:opacity-90', tones[h % tones.length], className)} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
