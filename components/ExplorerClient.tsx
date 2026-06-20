'use client'
import { useState, useMemo } from 'react'
import { Offer, Category } from '@/lib/airtable'
import OfferCard from './OfferCard'

function getPopularThreshold(offers: Offer[]): number {
  const clicks = offers.map(o => o.clicks || 0).filter(c => c > 0)
  if (clicks.length === 0) return Infinity
  const sorted = [...clicks].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * 0.9)
  return sorted[idx]
}

export default function ExplorerClient({
  offers,
  categories,
}: {
  offers: Offer[]
  categories: Category[]
}) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Toutes')

  const popularThreshold = useMemo(() => getPopularThreshold(offers), [offers])

  const filtered = useMemo(() => {
    return offers
      .filter(o => {
        const matchCat = activeCategory === 'Toutes' || o.category === activeCategory
        const matchSearch =
          search === '' ||
          o.brand.toLowerCase().includes(search.toLowerCase()) ||
          o.creator.toLowerCase().includes(search.toLowerCase()) ||
          o.code.toLowerCase().includes(search.toLowerCase())
        return matchCat && matchSearch
      })
      .sort((a, b) => a.brand.localeCompare(b.brand, 'fr'))
  }, [offers, search, activeCategory])

  return (
    <main style={{ paddingTop: 96, minHeight: '100vh' }}>
      <div className="container">
        <div style={{ marginBottom: 48 }}>
          <div className="section-label">Catalogue</div>
          <h1 style={{
            fontFamily: 'var(--font-syne)',
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 8,
          }}>
            Explorer les offres
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 16 }}>
            {offers.length} offres actives · mises à jour en temps réel
          </p>
        </div>

        <input
          type="text"
          placeholder="Rechercher une marque, un créateur, un code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            color: 'var(--text-1)',
            fontSize: 15,
            padding: '14px 20px',
            outline: 'none',
            fontFamily: 'var(--font-inter)',
            marginBottom: 24,
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,0,255,0.4)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 40 }}>
          {['Toutes', ...categories.map(c => c.name)].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '7px 16px',
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'var(--font-inter)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: activeCategory === cat ? 'var(--accent)' : 'var(--bg-surface)',
                color: activeCategory === cat ? '#fff' : 'var(--text-2)',
                border: activeCategory === cat
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 24, fontSize: 13, color: 'var(--text-3)' }}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          {activeCategory !== 'Toutes' && ` dans ${activeCategory}`}
          {search && ` pour "${search}"`}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <p style={{ fontFamily: 'var(--font-syne)', fontSize: 18, fontWeight: 700 }}>
              Aucune offre trouvée
            </p>
            <p style={{ fontSize: 14, marginTop: 8 }}>Essaie un autre mot-clé ou une autre catégorie</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
            paddingBottom: 96,
          }}>
            {filtered.map(offer => (
              <OfferCard
                key={offer.id}
                offer={offer}
                isPopular={(offer.clicks || 0) >= popularThreshold && popularThreshold < Infinity}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
