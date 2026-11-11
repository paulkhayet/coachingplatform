import { cn } from '@/lib/utils'

// The schedulefa.st mark: a calendar with a flowing "SF" (2026-11 design). Drawn with strokes in the
// current text color, so it works on light and dark backgrounds. Paths traced from the design file.
export const MARK_VIEWBOX = '362 98 528 542'

export function MarkPaths({ strokeScale = 1 }: { strokeScale?: number }) {
  const body = 34 * strokeScale
  const line = 35 * strokeScale
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="386" y="174" width="480" height="443" rx="97" strokeWidth={body} />
      <path d="M522 130V193M731 130V193" strokeWidth={50 * strokeScale} />
      <path d="M460 412H525C565 412 585 370 615 337C620 302 665 277 700 277H793" strokeWidth={line} />
      <path d="M460 525H530C570 525 615 490 618 455C645 410 670 363 705 363H793" strokeWidth={line} />
      <path d="M630 450H770" strokeWidth={line} />
    </g>
  )
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={cn('size-7', className)} aria-hidden="true">
      <MarkPaths />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[17px] font-bold tracking-[-0.03em]', className)}>
      <Mark className="size-6" />
      <span>schedulefa.st</span>
    </span>
  )
}
