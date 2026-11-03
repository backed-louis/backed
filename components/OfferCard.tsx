'use client'
import { Offer } from '@/lib/airtable'
import Link from 'next/link'
import { gainParts } from '@/lib/gain'
import CodeChip from '@/components/CodeChip'
import { BrandTile } from '@/components/PremiumCard'

function toSlug(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// Carte d'une offre dans la DA des vidéos : matière violette, l'avantage en grand, le code qui se dévoile et se copie.
export default function OfferCard({ offer, isPopular = false }: { offer: Offer; isPopular?: boolean }) {
  const g = gainParts(offer.benefit)
  const track = () => { fetch(`/api/track/${offer.id}`).catch(() => {}) } // l'offre affichée, pas la première au même slug
  const trackAndOpen = () => {
    track()
    if (offer.sourceUrl) window.open(offer.sourceUrl, '_blank')
  }

  return (
    <div className="offer-card pcard" onClick={trackAndOpen}>
      <span className="pcard-shine" aria-hidden />
      <div className="oc-head">
        <Link href={`/marque/${toSlug(offer.brand)}`} onClick={e => e.stopPropagation()} className="oc-brand-link">
          <BrandTile name={offer.brand} logo={offer.brandLogo} size={46} />
          <span className="oc-brand-txt">
            <span className="oc-brand">{offer.brand}</span>
            {offer.category && <span className="oc-cat">{offer.category}</span>}
          </span>
        </Link>
        {isPopular && <span className="oc-top">🔥 Top 10 %</span>}
      </div>

      {offer.benefit && (
        <div className="oc-gain">
          {g.value ? (
            <>
              <span className="oc-big grad">{g.value}<span className={`oc-unit${g.unit === '€' ? ' unit-eur' : ''}`}>{g.unit}</span></span>
              {g.rest && <span className="oc-rest">{g.rest}</span>}
            </>
          ) : (
            <span className="oc-text">{g.rest}</span>
          )}
        </div>
      )}

      {offer.brandDescription && <p className="oc-desc">{offer.brandDescription}</p>}

      <div className="oc-action">
        {offer.code && <CodeChip code={offer.code} onCopy={track} />}
        {!offer.code && offer.sourceUrl && (
          <button type="button" className="code-chip is-revealed" onClick={e => { e.stopPropagation(); trackAndOpen() }}>
            <span className="code-chip-code">Profiter de l&apos;offre ↗</span>
          </button>
        )}
        {offer.endDate && <span className="oc-end">Jusqu&apos;au {formatDate(offer.endDate)}</span>}
      </div>

      {offer.creator && (
        <div className="oc-credit">
          Partagé par{' '}
          <Link href={`/createur/${toSlug(offer.creator)}`} onClick={e => e.stopPropagation()}>{offer.creator}</Link>
        </div>
      )}
    </div>
  )
}
