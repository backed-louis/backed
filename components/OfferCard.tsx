'use client'
import { Offer } from '@/lib/airtable'
import { useState } from 'react'
import Link from 'next/link'

function toSlug(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function OfferCard({ offer, isPopular = false }: { offer: Offer; isPopular?: boolean }) {
  const [copied, setCopied] = useState(false)

  const trackAndOpen = (e?: React.MouseEvent) => {
    if (offer.slug) {
      fetch(`/api/track/${offer.slug}`).catch(() => {})
    }
    if (offer.sourceUrl) window.open(offer.sourceUrl, '_blank')
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!offer.code) return
    navigator.clipboard.writeText(offer.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (offer.slug) {
      fetch(`/api/track/${offer.slug}`).catch(() => {})
    }
  }

  return (
    <div className="offer-card" onClick={trackAndOpen}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href={`/marque/${toSlug(offer.brand)}`}
          onClick={e => e.stopPropagation()}
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}
        >
          {offer.brandLogo ? (
            <img src={offer.brandLogo} alt={offer.brand}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
          ) : (
            <span style={{ fontFamily: 'var(--font-syne)', fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>
              {offer.brand.slice(0, 2).toUpperCase()}
            </span>
          )}
        </Link>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isPopular && (
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              color: '#FF6B35',
              background: 'rgba(255,107,53,0.12)',
              border: '1px solid rgba(255,107,53,0.25)',
              padding: '3px 9px', borderRadius: 'var(--r-sm)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              🔥 Populaire
            </span>
          )}
          {offer.category && (
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
              color: 'var(--accent-text)',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              padding: '3px 9px', borderRadius: 'var(--r-sm)',
            }}>
              {offer.category}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <Link
          href={`/marque/${toSlug(offer.brand)}`}
          onClick={e => e.stopPropagation()}
          style={{ textDecoration: 'none' }}
        >
          <h3 style={{
            fontFamily: 'var(--font-syne)',
            fontSize: 18, fontWeight: 800,
            letterSpacing: '-0.01em', marginBottom: 6,
            color: 'var(--text-1)',
          }}>
            {offer.brand}
          </h3>
        </Link>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
          {offer.brandDescription}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        {offer.code && (
          <button
            onClick={handleCopy}
            style={{
              fontFamily: 'monospace',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              background: copied ? 'rgba(52,199,89,0.12)' : 'var(--accent-subtle)',
              border: `1px solid ${copied ? 'rgba(52,199,89,0.3)' : 'var(--accent-border)'}`,
              color: copied ? '#4CD964' : 'var(--accent-text)',
              padding: '6px 12px', borderRadius: 'var(--r-md)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {copied ? '✓ Copié !' : offer.code}
          </button>
        )}
        {offer.benefit && (
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: '#4CD964',
            background: 'rgba(52,199,89,0.1)',
            border: '1px solid rgba(52,199,89,0.18)',
            padding: '4px 10px', borderRadius: 'var(--r-sm)',
            lineHeight: 1.4,
            display: 'block',
          }}>
            {offer.benefit}
          </span>
        )}
      </div>

      {offer.creator && (
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 12, fontSize: 12, color: 'var(--text-3)',
        }}>
          Partagé par{' '}
          <Link
            href={`/createur/${toSlug(offer.creator)}`}
            onClick={e => e.stopPropagation()}
            style={{ color: 'var(--text-2)', fontWeight: 500, textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
          >
            {offer.creator}
          </Link>
        </div>
      )}
    </div>
  )
}
