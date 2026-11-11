'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/**
 * A browser window showing a real schedulefa.st screen, laid out at its true size (`width`) and scaled to
 * fit the space it's given, like a screenshot that stays sharp. The screen is decorative: hidden from
 * assistive tech and not focusable (`inert`); `label` describes it instead.
 */
export function ScaledPreview({ width, label, url, children, className }: { width: number; label: string; url: string; children: React.ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ scale: number; height: number } | null>(null)

  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const measure = () => {
      const scale = Math.min(1, o.clientWidth / width)
      setFit({ scale, height: i.offsetHeight * scale })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
  }, [width])

  return (
    <figure className={`ui-frame ${className ?? ''}`} role="img" aria-label={label}>
      <div className="ui-frame-bar" aria-hidden="true">
        <span className="ui-frame-dots"><i></i><i></i><i></i></span>
        <span className="ui-frame-url">{url}</span>
      </div>
      <div ref={outer} className="ui-frame-stage" style={{ height: fit?.height }} aria-hidden="true">
        <div ref={inner} className="product-ui" inert style={{ width, transform: `scale(${fit?.scale ?? 1})`, visibility: fit ? 'visible' : 'hidden' }}>
          {children}
        </div>
      </div>
    </figure>
  )
}
