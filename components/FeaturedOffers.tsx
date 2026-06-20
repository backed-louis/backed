import Link from 'next/link'
import OfferCard from './OfferCard'
import { type Offer } from '@/lib/airtable'
import { isPopularOffer } from '@/lib/popularUtils'

export default function FeaturedOffers({ offers, popularThreshold }: { offers: Offer[]; popularThreshold: number }) {
  return (
    <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="container">
        <div className="section-label">En ce moment 🔥</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48 }}>
          <h2 className="section-title" style={{ fontFamily: 'var(--font-syne)', marginBottom: 0 }}>
            Offres à la une
          </h2>
          <Link href="/explorer" className="link-muted">
            Voir tout →
          </Link>
        </div>
        {offers.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Aucune offre à la une pour le moment.
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {offers.map(offer => (
              <OfferCard
                key={offer.id}
                offer={offer}
                isPopular={isPopularOffer(offer, popularThreshold)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
