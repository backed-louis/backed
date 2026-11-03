'use client'
import Link from 'next/link'
import { WhatsAppIcon } from '@/components/WhatsAppBanner'
import { WHATSAPP_CHANNEL_URL, YOUTUBE_URL } from '@/lib/links'
import { YouTubeIcon } from '@/components/Footer'
import { SaisonNote } from '@/components/Saison'
import { SaisonHero } from '@/components/SaisonDecor'
import PremiumCard from '@/components/PremiumCard'
import { type Offer } from '@/lib/airtable'

interface HeroProps {
  offerCount: number
  creatorCount: number
  top: Offer | null // le code le plus copié de la semaine, en grande carte (code masqué à moitié, comme dans les vidéos)
}

export default function Hero({ offerCount, creatorCount, top }: HeroProps) {
  return (
    <section className="hero">
      <SaisonHero />
      <div className={`hero-grid${top ? '' : ' hero-solo'}`}>
        <div className="hero-copy">
          <span className="hero-pill">
            <span className="hero-dot" /> {offerCount} offres actives · {creatorCount} créateurs soutenus
          </span>
          <SaisonNote />
          <h1 className="hero-title">
            Paie le <span className="grad">bon prix.</span>
          </h1>
          <p className="hero-sub">
            {offerCount} offres de tes créateurs YouTube.
            Cherche une marque, copie le code. Gratuit, sans compte.
          </p>
          <div className="hero-ctas">
            <Link href="/explorer" className="btn-primary">Trouver un code</Link>
            <Link href="/createurs" className="btn-ghost">Voir les créateurs</Link>
          </div>
          <div className="hero-links">
            <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer">
              <span style={{ color: '#25D366', display: 'inline-flex' }}><WhatsAppIcon size={16} /></span>
              1 code par jour sur WhatsApp
              <span className="hero-link-cta">Rejoindre →</span>
            </a>
            <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
              <span style={{ color: '#FF0033', display: 'inline-flex' }}><YouTubeIcon size={16} /></span>
              Le code du jour en vidéo sur YouTube
              <span className="hero-link-cta">S&apos;abonner →</span>
            </a>
          </div>
        </div>
        {top && (
          <div className="hero-card">
            <PremiumCard offer={top} kicker="Le plus copié" masked />
          </div>
        )}
      </div>
    </section>
  )
}
