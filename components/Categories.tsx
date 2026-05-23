import { getCategories } from '@/lib/airtable'
import Link from 'next/link'

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

export default async function Categories({ offerCounts = {} }: { offerCounts?: Record<string, number> }) {
  const categories = await getCategories()

  return (
    <section className="section" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
      <div className="container">
        <div className="section-label">Parcourir</div>
        <h2 className="section-title" style={{ fontFamily: 'var(--font-syne)' }}>
          Choisis ta catégorie
        </h2>
        <p className="section-sub">Explore les offres par univers</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: 10,
        }}>
          {categories.map(cat => (
            <Link key={cat.id} href={`/categorie/${cat.slug}`} className="category-card">
              <span style={{ fontSize: 22, lineHeight: 1 }}>{ICONS[cat.slug] || '📦'}</span>
              <span style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 14, fontWeight: 700,
                letterSpacing: '-0.01em',
                marginTop: 4,
              }}>
                {cat.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {offerCounts[cat.name] || 0} offres
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
