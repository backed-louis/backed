'use client'
import Link from 'next/link'
import { SaisonNote } from '@/components/Saison'
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
      <div className={`hero-grid${top ? '' : ' hero-solo'}`}>
        <div className="hero-copy">
          <span className="hero-pill">
            <span className="hero-dot" /> {offerCount} offres actives · {creatorCount} créateurs soutenus
          </span>
          <SaisonNote />
          <h1 className="hero-title">
            paie le <span className="hl">bon prix.</span>
          </h1>
          <p className="hero-sub">
            {offerCount} offres de tes créateurs YouTube.
            Cherche une marque, copie le code. Gratuit, sans compte.
          </p>
          <div className="hero-ctas">
            <Link href="/explorer" className="btn-primary">Trouver un code</Link>
            <Link href="/createurs" className="btn-ghost">Voir les créateurs</Link>
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
