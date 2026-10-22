import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://coulda.fun'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  title: 'COULDA — You Coulda Been Rich',
  description: 'One decision. One hypothetical pump. One brutal regret receipt. Can you do better?',
  generator: 'v0.app',
  keywords: ['COULDA', 'daily challenge', 'crypto simulation', 'meme coin', 'regret simulator', 'internet experiment'],
  openGraph: {
    title: 'I Got Cooked by COULDA.',
    description: 'One decision. One hypothetical pump. One brutal regret receipt. Can you do better?',
    type: 'website',
    images: [{ url: '/coulda-mascot.png', width: 1312, height: 820, alt: 'COULDA mascot watching a fictional chart pump' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@COULDAPUMP',
    creator: '@COULDAPUMP',
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
