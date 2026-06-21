import type { Metadata } from 'next'
import { Inter, Syne } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
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
export const metadata: Metadata = {
  title: 'Backed — Les meilleures offres des créateurs',
  description:
    'Codes promo vérifiés, partagés par vos créateurs préférés. Accès immédiat, sans création de compte.',
  metadataBase: new URL('https://www.backed.fr'),
  openGraph: {
    title: 'Backed — Les meilleures offres des créateurs',
    description:
      'Codes promo vérifiés, partagés par vos créateurs préférés. Accès immédiat, sans création de compte.',
    url: 'https://www.backed.fr',
    siteName: 'Backed',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Backed — Les meilleures offres des créateurs',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Backed — Les meilleures offres des créateurs',
    description:
      'Codes promo vérifiés, partagés par vos créateurs préférés. Accès immédiat, sans création de compte.',
    images: ['/og-image.png'],
  },
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${syne.variable}`}>
      <body style={{ fontFamily: 'var(--font-inter)' }}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
