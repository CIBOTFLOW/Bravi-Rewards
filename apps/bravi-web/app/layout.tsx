import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { AppShell } from '@/components/AppShell'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Bravi Rewards',
    template: '%s · Bravi Rewards',
  },
  description: 'Turn earned capacity into useful moments for yourself and your community.',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#102e2a',
  colorScheme: 'light',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
