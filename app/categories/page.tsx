import { getAllOffers, getCategories } from '@/lib/airtable'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const ICONS: Record<string, string> = {
  'food-courses': '🍕', food: '🍕',
  'tech-gaming': '🎮',
  voyage: '✈️',
  animaux: '🐶',
  ecommerce: '🛍️',
  finance: '💰',
  sante: '💪',
  education: '📚',
  auto: '🚗',
  decoration: '🖼️',
  divertissement: '🎬',
  mode: '👗',
  sport: '🏋️',
  rencontres: '💕',
  beaute: '💄',
}

export default async function CategoriesPage() {
  const [categories, allOffers] = await Promise.all([
    getCategories(),
    getAllOffers(),
  ])

  const offerCounts: Record<string, number> = {}
  allOffers.forEach(offer => {
    if (offer.category) {
      offerCounts[offer.category] = (offerCounts[offer.category] || 0) + 1
    }
  })

  const totalOffers = allOffers.length

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          <div style={{ paddingTop: 32, marginBottom: 56 }}>
            <div className="section-label">Parcourir</div>
            <h1 style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: 8,
            }}>
              Toutes les catégories
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 16 }}>
              {categories.length} univers · {totalOffers} offres au total
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            paddingBottom: 96,
          }}>
            {categories.map(cat => {
              const count = offerCounts[cat.name] || 0
              return (
                <Link key={cat.id} href={`/categorie/${cat.slug}`} className="category-card">
                  <span style={{ fontSize: 32, lineHeight: 1 }}>{ICONS[cat.slug] || '📦'}</span>
                  <span style={{
                    fontFamily: 'var(--font-syne)',
                    fontSize: 16, fontWeight: 700,
                    letterSpacing: '-0.01em',
                    marginTop: 8,
                  }}>
                    {cat.name}
                  </span>
                  <span style={{ fontSize: 13, color: count > 0 ? 'var(--text-3)' : 'var(--text-4)' }}>
                    {count} offre{count !== 1 ? 's' : ''}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </>
  )
}
