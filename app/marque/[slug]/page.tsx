import { getAllOffers } from '@/lib/airtable'
import { notFound } from 'next/navigation'
import OfferCard from '@/components/OfferCard'
import Navbar from '@/components/Navbar'
import { getPopularThreshold, isPopularOffer } from '@/lib/popularUtils'
import type { Metadata } from 'next'

export const revalidate = 3600

function toSlug(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const allOffers = await getAllOffers()
  const offers = allOffers.filter(o => toSlug(o.brand) === slug)
  if (offers.length === 0) return {}
  const brand = offers[0]
  return {
    title: `Code promo ${brand.brand} — Backed`,
    description: `${offers.length} offre${offers.length > 1 ? 's' : ''} active${offers.length > 1 ? 's' : ''} chez ${brand.brand}. ${brand.brandDescription || `Retrouvez les meilleurs codes promo ${brand.brand} partagés par vos créateurs préférés.`}`,
    openGraph: {
      title: `Code promo ${brand.brand} — Backed`,
      description: `${offers.length} offre${offers.length > 1 ? 's' : ''} active${offers.length > 1 ? 's' : ''} chez ${brand.brand} sur Backed.`,
    },
  }
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

  const popularThreshold = getPopularThreshold(allOffers)

  // Schema Markup JSON-LD
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Codes promo ${brand.name}`,
    description: brand.description || `Codes promo ${brand.name} partagés par des créateurs`,
    url: `https://www.backed.fr/marque/${slug}`,
    numberOfItems: offers.length,
    itemListElement: offers
      .filter(o => o.code || o.benefit)
      .map((offer, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Offer',
          name: offer.code ? `Code promo ${brand.name} : ${offer.code}` : `Offre ${brand.name}`,
          description: offer.benefit || '',
          url: offer.sourceUrl || `https://www.backed.fr/marque/${slug}`,
          ...(offer.code && { discount: offer.code }),
          seller: {
            '@type': 'Organization',
            name: brand.name,
            ...(brand.website && { url: brand.website }),
          },
        },
      })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
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
              <OfferCard
                key={offer.id}
                offer={offer}
                isPopular={isPopularOffer(offer, popularThreshold)}
              />
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
