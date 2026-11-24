import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import SaisonDecor from '@/components/SaisonDecor'
import { SITE_URL, SOCIAL_URLS } from '@/lib/links'
// Polices hébergées dans le dépôt (app/fonts, licence OFL), plus téléchargées chez Google à chaque build :
// ce téléchargement faisait échouer des builds Vercel au hasard (« next/font/google queries have exactly one entry »).
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
})
const syne = localFont({
  src: './fonts/syne-latin-wght-normal.woff2',
  variable: '--font-syne',
  weight: '400 800',
  display: 'swap',
})
// Les petites étiquettes en mono espacé de la DA (« CODE DU JOUR »)
const mono = localFont({
  src: './fonts/jetbrains-mono-latin-wght-normal.woff2',
  variable: '--font-mono',
  weight: '100 800',
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
// Backed et ses comptes (YouTube, Instagram, TikTok) : Google peut les relier au site.
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Backed',
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  description: 'Les codes promo de tes créateurs YouTube, au même endroit. Gratuit, sans compte.',
  sameAs: SOCIAL_URLS,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${syne.variable} ${mono.variable}`}>
      <body style={{ fontFamily: 'var(--font-inter)' }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <div className="ambience" aria-hidden><div className="ambience-grain" /><div className="ambience-vignette" /></div>
        {children}
        <SaisonDecor />
        <Analytics />
      </body>
    </html>
  )
}
