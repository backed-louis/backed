import { getAllOffers } from '@/lib/airtable'
import { notFound } from 'next/navigation'
import OfferCard from '@/components/OfferCard'
import Navbar from '@/components/Navbar'

export const dynamic = 'force-dynamic'

function toSlug(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default async function MarquePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const allOffers = await getAllOffers()

  const offers = allOffers.filter(o => toSlug(o.brand) === slug)
  if (offers.length === 0) notFound()

  const brand = {
    name: offers[0].brand,
    description: offers[0].brandDescription,
    logo: offers[0].brandLogo,
    website: offers[0].brandWebsite,
    category: offers[0].category,
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          <div style={{ paddingTop: 32, marginBottom: 56 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 16,
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20, overflow: 'hidden',
            }}>
              {brand.logo ? (
                <img src={brand.logo} alt={brand.name} style={{ width: 48, height: 48, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontFamily: 'var(--font-syne)', fontSize: 28, fontWeight: 800, color: 'var(--accent-text)' }}>
                  {brand.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="section-label">
              {offers.length} offre{offers.length !== 1 ? 's' : ''} active{offers.length !== 1 ? 's' : ''}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12,
            }}>
              {brand.name}
            </h1>

            {brand.description && (
              <p style={{ color: 'var(--text-2)', fontSize: 16, marginBottom: 12 }}>
                {brand.description}
              </p>
            )}

            {brand.website && (
              <a href={brand.website} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 13, color: 'var(--accent)', fontWeight: 500,
              }}>
                {brand.website.replace(/^https?:\/\//, '')} ↗
              </a>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16, paddingBottom: 96,
          }}>
            {offers.map(offer => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
