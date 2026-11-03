'use client'
import Link from 'next/link'
import { type Offer } from '@/lib/airtable'
import { gainParts } from '@/lib/gain'
import CodeChip from '@/components/CodeChip'

function toSlug(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function BrandTile({ name, logo, size = 56 }: { name: string; logo: string | null; size?: number }) {
  return (
    <span className="brand-tile" style={{ width: size, height: size, borderRadius: size * 0.24 }}>
      {logo
        ? <img src={logo} alt={name} />
        : <span className="brand-tile-letter" style={{ fontSize: size * 0.5 }}>{name.charAt(0).toUpperCase()}</span>}
    </span>
  )
}

// La carte premium des vidéos (accroche « Code du jour ») : en-tête marque, carte en 3D qui flotte,
// l'avantage en grand et le code (masqué à moitié en page d'accueil, au clic il se dévoile et se copie).
export default function PremiumCard({
  offer, kicker, masked = false, float = true, header = true,
}: { offer: Offer; kicker: string; masked?: boolean; float?: boolean; header?: boolean }) {
  const g = gainParts(offer.benefit)
  const track = () => { fetch(`/api/track/${offer.id}`).catch(() => {}) }
  const open = () => { track(); if (offer.sourceUrl) window.open(offer.sourceUrl, '_blank') }

  return (
    <div className="pc-wrap">
      {header && (
        <Link href={`/marque/${toSlug(offer.brand)}`} className="pc-head">
          <BrandTile name={offer.brand} logo={offer.brandLogo} size={64} />
          <span>
            <span className="kicker">{kicker}</span>
            <span className="pc-brand">{offer.brand}</span>
          </span>
        </Link>
      )}
      <div className={`pc-stage${float ? ' pc-float' : ''}`}>
        <div className="pcard pc-card">
          <span className="pcard-shine" aria-hidden />
          <div className="pc-gain">
            {g.value ? (
              <>
                <span className="pc-big grad">{g.value}<span className={`pc-unit${g.unit === '€' ? ' unit-eur' : ''}`}>{g.unit}</span></span>
                {g.rest && <span className="pc-rest">{g.rest}</span>}
              </>
            ) : (
              <span className="pc-text grad">{g.rest}</span>
            )}
          </div>
          <div className="pc-foot">
            {offer.creator ? (
              <span className="pc-credit">
                Partagé par{' '}
                <Link href={`/createur/${toSlug(offer.creator)}`} onClick={e => e.stopPropagation()}>{offer.creator}</Link>
              </span>
            ) : <span />}
            {offer.code
              ? <CodeChip code={offer.code} masked={masked} size="lg" onCopy={track} />
              : offer.sourceUrl && (
                <button type="button" className="code-chip code-chip-lg is-revealed" onClick={open}>
                  <span className="code-chip-code">Profiter de l&apos;offre ↗</span>
                </button>
              )}
          </div>
        </div>
        <div className="pc-floor" aria-hidden />
      </div>
    </div>
  )
}
