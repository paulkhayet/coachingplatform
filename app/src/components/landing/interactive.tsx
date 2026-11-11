'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/** Header navigation with the mobile menu toggle. */
export function SiteNav() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const wide = matchMedia('(min-width: 601px)')
    const onWide = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    wide.addEventListener('change', onWide)
    return () => {
      document.removeEventListener('keydown', onKey)
      wide.removeEventListener('change', onWide)
    }
  }, [])
  const close = () => setOpen(false)
  return (
    <>
      <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-nav" aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen(!open)}>
        <span></span>
        <span></span>
      </button>
      <nav className={`main-nav${open ? ' open' : ''}`} id="main-nav" aria-label="Main navigation">
        <a href="#platform" onClick={close}>Features</a>
        <a href="#how-it-works" onClick={close}>How it works</a>
        <a href="#pricing" onClick={close}>Pricing</a>
        <Link href="/sign-in" onClick={close}>Sign in</Link>
        <Link className="button button-small nav-cta" href="/sign-up" onClick={close}>
          Create your business <svg className="icon"><use href="#arrow-up-right" /></svg>
        </Link>
      </nav>
    </>
  )
}

export interface FlowTab {
  id: string
  title: string
  summary: string
  panel: React.ReactNode
}

/** The "how it works" tabs: arrow keys move between them, as in the original design. */
export function WorkflowTabs({ tabs }: { tabs: FlowTab[] }) {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const select = (i: number, focus = false) => {
    setActive(i)
    if (focus) refs.current[i]?.focus()
  }
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = tabs.length
    let target: number | undefined
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') target = (i + 1) % n
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') target = (i + n - 1) % n
    if (e.key === 'Home') target = 0
    if (e.key === 'End') target = n - 1
    if (target !== undefined) {
      e.preventDefault()
      select(target, true)
    }
  }
  return (
    <div className="workflow-layout">
      <div className="workflow-tabs" role="tablist" aria-label="How schedulefa.st works" aria-orientation="vertical">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            className={`workflow-tab${i === active ? ' active' : ''}`}
            id={`${t.id}-tab`}
            role="tab"
            aria-selected={i === active}
            aria-controls={`${t.id}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => select(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="tab-number">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <b>{t.title}</b>
              <small>{t.summary}</small>
            </span>
            <svg className="icon"><use href="#arrow-up-right" /></svg>
          </button>
        ))}
      </div>
      <div className="workflow-visual">
        {tabs.map((t, i) => (
          <div key={t.id} id={`${t.id}-panel`} className={`flow-panel ${t.id}-panel`} role="tabpanel" aria-labelledby={`${t.id}-tab`} hidden={i !== active}>
            {t.panel}
          </div>
        ))}
      </div>
    </div>
  )
}
