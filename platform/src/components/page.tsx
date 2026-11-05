import * as React from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-xs">
      <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
        {label}
        {icon}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="text-muted-foreground mt-0.5 text-xs">{hint}</div>}
    </div>
  )
}

export function Empty({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
      {icon && <div className="bg-muted text-muted-foreground mb-3 flex size-10 items-center justify-center rounded-full [&_svg]:size-5">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="text-muted-foreground mt-1 max-w-sm text-sm">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="text-sm font-medium">{label}</div>
      {children}
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  )
}

export function KV({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="grid gap-2.5 text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4">
          <dt className="text-muted-foreground shrink-0">{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
