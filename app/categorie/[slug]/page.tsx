import { getAllOffers, getCategories } from '@/lib/airtable'
import { notFound } from 'next/navigation'
import OfferCard from '@/components/OfferCard'
import Navbar from '@/components/Navbar'

export const revalidate = 3600

const ICONS: Record<string, string> = {
  'food-courses': '🍕', food: '🍕',
  'tech-gaming': '🎮',
  voyage: '✈️',
  animaux: '🐾',
  ecommerce: '🛍️',
  finance: '💰',
  sante: '💪',
  education: '📚',
  auto: '🚗',
  decoration: '🏠',
  divertissement: '🎬',
  mode: '👗',
}

export async function generateStaticParams() {
  const categories = await getCategories()
  return categories.map(c => ({ slug: c.slug }))
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const [allOffers, categories] = await Promise.all([
    getAllOffers(),
    getCategories(),
  ])

  const category = categories.find(c => c.slug === params.slug)
  if (!category) notFound()

  const offers = allOffers.filter(o => o.category === category.name)

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          <div style={{ paddingTop: 32, marginBottom: 56 }}>
            <div style={{ fontSize: 52, marginBottom: 16, lineHeight: 1 }}>
              {ICONS[category.slug] || '📦'}
            </div>
            <div className="section-label">{offers.length} offre{offers.length !== 1 ? 's' : ''} active{offers.length !== 1 ? 's' : ''}</div>
            <h1 style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
            }}>
              {category.name}
            </h1>
          </div>

          {offers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
              <p style={{ fontFamily: 'var(--font-syne)', fontSize: 18, fontWeight: 700 }}>
                Aucune offre dans cette catégorie pour le moment.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
              paddingBottom: 96,
            }}>
              {offers.map(offer => (
                <OfferCard key={offer.id} offer={offer} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}