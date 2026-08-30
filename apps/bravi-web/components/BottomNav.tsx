'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/discover', label: 'Discover', icon: '◎' },
  { href: '/give', label: 'Give', icon: '↗' },
  { href: '/activity', label: 'Activity', icon: '≋' },
  { href: '/you', label: 'You', icon: '○' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link href={item.href} aria-current={active ? 'page' : undefined} key={item.href}>
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
