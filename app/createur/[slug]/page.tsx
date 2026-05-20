import { getAllCreators, getAllOffers } from '@/lib/airtable'
import { notFound } from 'next/navigation'
import OfferCard from '@/components/OfferCard'
import Navbar from '@/components/Navbar'

export const dynamic = 'force-dynamic'

export default async function CreateurPage({ params }: { params: { slug: string } }) {
  const [creators, allOffers] = await Promise.all([
    getAllCreators(),
    getAllOffers(),
  ])

  const creator = creators.find(c => c.slug === params.slug)
  if (!creator) notFound()

  const offers = allOffers.filter(o => o.creator === creator.name)

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          <div style={{ paddingTop: 32, marginBottom: 56 }}>
            {/* Avatar */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-syne)',
              fontSize: 28, fontWeight: 800, color: 'var(--accent-text)',
              marginBottom: 20,
            }}>
              {creator.name.charAt(0).toUpperCase()}
            </div>

            <div className="section-label">
              {offers.length} offre{offers.length !== 1 ? 's' : ''} active{offers.length !== 1 ? 's' : ''}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12,
            }}>
              {creator.name}
            </h1>

            {/* Platforms */}
            <div style={{ display: 'flex', gap: 8 }}>
              {creator.platforms.map(p => (
                <span key={p} style={{
                  fontSize: 12, fontWeight: 600,
                  padding: '4px 12px', borderRadius: 100,
                  background: p === 'Youtube' ? 'rgba(255,0,0,0.1)' : 'rgba(145,71,255,0.1)',
                  color: p === 'Youtube' ? '#FF4444' : '#9147FF',
                  border: `1px solid ${p === 'Youtube' ? 'rgba(255,0,0,0.2)' : 'rgba(145,71,255,0.2)'}`,
                }}>
                  {p}
                </span>
              ))}
            </div>
          </div>

          {offers.length === 0 ? (
            <p style={{ color: 'var(--text-3)' }}>Aucune offre active pour ce créateur.</p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16, paddingBottom: 96,
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