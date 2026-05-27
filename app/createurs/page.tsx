import { getAllCreators, getAllOffers } from '@/lib/airtable'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export const revalidate = 3600

export default async function CreateursPage() {
  const [creators, allOffers] = await Promise.all([
    getAllCreators(),
    getAllOffers(),
  ])
  const offerCounts: Record<string, number> = {}
  allOffers.forEach(offer => {
    if (offer.creator) {
      offerCounts[offer.creator] = (offerCounts[offer.creator] || 0) + 1
    }
  })
  const creatorsWithOffers = creators.filter(c => offerCounts[c.name] > 0)
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          <div style={{ paddingTop: 32, marginBottom: 56 }}>
            <div className="section-label">Communauté</div>
            <h1 style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8,
            }}>
              Les créateurs
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 16 }}>
              {creatorsWithOffers.length} créateurs · codes vérifiés
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12, paddingBottom: 96,
          }}>
            {creatorsWithOffers.map(creator => {
              const count = offerCounts[creator.name] || 0
              return (
                <Link key={creator.id} href={`/createur/${creator.slug}`} className="creator-card">
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    overflow: 'hidden',
                    border: '1px solid var(--accent-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--accent-subtle)',
                    flexShrink: 0,
                  }}>
                    {creator.avatar ? (
                      <img
                        src={creator.avatar}
                        alt={creator.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{
                        fontFamily: 'var(--font-syne)',
                        fontSize: 18, fontWeight: 800, color: 'var(--accent-text)',
                      }}>
                        {creator.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-syne)',
                      fontSize: 16, fontWeight: 700,
                      letterSpacing: '-0.01em', marginBottom: 4,
                    }}>
                      {creator.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      {count} offre{count !== 1 ? 's' : ''} active{count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {creator.platforms.map(p => (
                      <span key={p} style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 'var(--r-sm)',
                        background: p === 'Youtube' ? 'rgba(255,0,0,0.1)' : 'rgba(145,71,255,0.1)',
                        color: p === 'Youtube' ? '#FF4444' : '#9147FF',
                        border: `1px solid ${p === 'Youtube' ? 'rgba(255,0,0,0.2)' : 'rgba(145,71,255,0.2)'}`,
                      }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </>
  )
}
