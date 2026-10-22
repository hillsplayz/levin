import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://coulda.example'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'COULDA Daily Challenge — Buy or Skip?',
  description: 'Play the same fictional crypto scenario as everyone else, lock in BUY or SKIP, and reveal your hypothetical COULDA result.',
  generator: 'v0.app',
  keywords: ['COULDA', 'daily challenge', 'crypto simulation', 'meme coin', 'regret simulator', 'internet experiment'],
  openGraph: {
    title: 'YOU COULDA BEEN RICH.',
    description: 'You found it early. You hesitated. Someone else bought it.',
    type: 'website',
    images: [{ url: '/coulda-mascot.png', width: 1312, height: 820, alt: 'COULDA mascot watching a fictional chart pump' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YOU COULDA BEEN RICH.',
    description: 'The coin you didn’t buy.',
    images: ['/coulda-mascot.png'],
  },
  icons: { icon: '/icon.svg' },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#090b0a',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`bg-background ${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
