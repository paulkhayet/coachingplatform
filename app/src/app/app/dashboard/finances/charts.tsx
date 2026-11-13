import { cn } from '@/lib/utils'

// Small server-rendered charts for Finances (D-074): plain SVG and CSS on the app's colour tokens, so
// they follow light and dark mode and need no chart library.

const compact = (cents: number) => {
  const dollars = cents / 100
  const abs = Math.abs(dollars)
  const text = abs >= 10_000 ? `${(abs / 1000).toFixed(0)}k` : abs >= 1000 ? `${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k` : abs.toFixed(0)
  return `${dollars < 0 ? '−' : ''}$${text}`
}
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)

export interface MonthPoint { label: string; revenue: number; pay: number; profit: number }

const SERIES = [
  { key: 'revenue', label: 'Revenue', fill: 'fill-primary', dot: 'bg-primary' },
  { key: 'pay', label: 'Coach pay', fill: 'fill-warning', dot: 'bg-warning' },
  { key: 'profit', label: 'Profit', fill: 'fill-success', dot: 'bg-success' },
] as const

/** Revenue, coach pay and profit for each month, as grouped bars around a zero line. */
export function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const values = data.flatMap((d) => [d.revenue, d.pay, d.profit])
  const top = Math.max(1, ...values)
  const bottom = Math.min(0, ...values)
  const W = 720
  const H = 200
  const padLeft = 44
  const padBottom = 22
  const plotH = H - padBottom - 8
  const y = (v: number) => 8 + plotH * (top - v) / (top - bottom)
  const group = (W - padLeft) / data.length
  const bar = Math.min(14, (group - 10) / 3)
  return (
    <figure className="grid gap-2">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {SERIES.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className={cn('size-2.5 rounded-sm', s.dot)} aria-hidden="true" />{s.label}</span>)}
      </figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full min-w-[34rem]" role="img" aria-label="Revenue, coach pay and profit by month. The same numbers are in the table below.">
          {[top, bottom < 0 ? bottom : null].map((v) => v !== null && (
            <g key={v}>
              <line x1={padLeft} x2={W} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray="3 3" />
              <text x={padLeft - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{compact(v)}</text>
            </g>
          ))}
          <line x1={padLeft} x2={W} y1={y(0)} y2={y(0)} className="stroke-muted-foreground/50" />
          <text x={padLeft - 6} y={y(0) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">$0</text>
          {data.map((d, i) => {
            const x0 = padLeft + i * group + (group - bar * 3 - 4) / 2
            return (
              <g key={d.label}>
                {SERIES.map((s, j) => {
                  const v = d[s.key]
                  const height = Math.max(v === 0 ? 0 : 1.5, Math.abs(y(v) - y(0)))
                  return <rect key={s.key} x={x0 + j * (bar + 2)} y={v >= 0 ? y(0) - height : y(0)} width={bar} height={height} rx={1.5} className={s.fill}><title>{`${d.label} ${s.label}: ${money(v)}`}</title></rect>
                })}
                <text x={padLeft + i * group + group / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{d.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer text-xs">Show as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[24rem] text-xs">
            <thead><tr className="text-muted-foreground border-b text-left"><th className="py-1 font-medium">Month</th>{SERIES.map((s) => <th key={s.key} className="py-1 text-right font-medium">{s.label}</th>)}</tr></thead>
            <tbody>{data.map((d) => <tr key={d.label} className="border-b last:border-0"><td className="py-1">{d.label}</td>{SERIES.map((s) => <td key={s.key} className="py-1 text-right tabular-nums">{money(d[s.key])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

export interface BarRow { label: string; value: number; display: string; note?: string }

/** Horizontal bars with the figure at the end of each row. Zero and negative values get an empty bar. */
export function BarList({ rows, empty, tone = 'bg-primary' }: { rows: BarRow[]; empty: string; tone?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="text-muted-foreground text-sm">{empty}</p>
  return (
    <ul className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}{r.note && <span className="text-muted-foreground"> · {r.note}</span>}</span>
            <span className="shrink-0 font-medium tabular-nums">{r.display}</span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden="true"><div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.max(0, Math.min(100, r.value / max * 100))}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}
