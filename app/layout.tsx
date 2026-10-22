import type { Metadata } from 'next'
import { Inter, Syne } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import SaisonDecor from '@/components/SaisonDecor'
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})
// Laisse le temps d'attendre la fin d'un blocage Airtable (429, 30 s) au lieu d'échouer.
export const maxDuration = 60

export const metadata: Metadata = {
  title: 'Backed — Les codes promo de tes créateurs YouTube',
  description:
    'Les codes promo de tes créateurs YouTube, au même endroit. Gratuit, sans compte.',
  metadataBase: new URL('https://www.backed.fr'),
  openGraph: {
    title: 'Backed — Les codes promo de tes créateurs YouTube',
    description:
      'Les codes promo de tes créateurs YouTube, au même endroit. Gratuit, sans compte.',
    url: 'https://www.backed.fr',
    siteName: 'Backed',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Backed — Les codes promo de tes créateurs YouTube',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Backed — Les codes promo de tes créateurs YouTube',
    description:
      'Les codes promo de tes créateurs YouTube, au même endroit. Gratuit, sans compte.',
    images: ['/og-image.png'],
  },
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${syne.variable}`}>
      <body style={{ fontFamily: 'var(--font-inter)' }}>
        {children}
        <SaisonDecor />
        <Analytics />
      </body>
    </html>
  )
}
