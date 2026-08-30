import Link from 'next/link'
import type { ReactNode } from 'react'

import { BottomNav } from '@/components/BottomNav'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Bravi Rewards home">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>bravi</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/discover">Discover</Link>
          <Link href="/give">Give</Link>
          <Link href="/activity">Activity</Link>
          <Link href="/you">You</Link>
        </nav>
        <span className="environment-pill">Preview · no effect</span>
      </header>
      <div className="page-frame">{children}</div>
      <BottomNav />
    </div>
  )
}
