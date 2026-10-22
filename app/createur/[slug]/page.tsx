import { getAllCreators, getAllOffers } from '@/lib/airtable'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'
import OfferCard from '@/components/OfferCard'
import WhatsAppBanner from '@/components/WhatsAppBanner'
import Navbar from '@/components/Navbar'
import { getPopularThreshold, isPopularOffer } from '@/lib/popularUtils'

export const revalidate = 3600

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const [creators, allOffers] = await Promise.all([getAllCreators(), getAllOffers()])
  const creator = creators.find(c => c.slug === slug)
  if (!creator) return { title: 'Créateur introuvable | Backed' }

  const offers = allOffers.filter(o => o.creator === creator.name)
  const count = offers.length
  const brands = Array.from(new Set(offers.map(o => o.brand)))
  const shown = brands.slice(0, 3)
  const title = `Codes promo de ${creator.name} — ${count} offre${count !== 1 ? 's' : ''} active${count !== 1 ? 's' : ''} | Backed`
  const description = count
    ? `Les codes promo partagés par ${creator.name} sur YouTube : ${shown.join(', ')}${brands.length > shown.length ? '…' : ''}. Profite de ses offres et soutiens ${creator.name}. Gratuit, sans compte.`
    : `Les codes promo partagés par ${creator.name} sur YouTube, au même endroit sur Backed.`
  const url = `${SITE_URL}/createur/${creator.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile' },
    // Sans offre active, la page reste accessible mais n'est pas proposée à Google (page vide).
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function CreateurPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [creators, allOffers] = await Promise.all([
    getAllCreators(),
    getAllOffers(),
  ])
  const creator = creators.find(c => c.slug === slug)
  if (!creator) notFound()

  const offers = allOffers.filter(o => o.creator === creator.name)
  const popularThreshold = getPopularThreshold(allOffers)

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          <div style={{ paddingTop: 32, marginBottom: 56 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid var(--accent-border)',
              marginBottom: 20,
              background: 'var(--accent-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                  fontSize: 28, fontWeight: 800, color: 'var(--accent-text)',
                }}>
                  {creator.name.charAt(0).toUpperCase()}
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
              {creator.name}
            </h1>
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
              gap: 16, paddingBottom: 32,
            }}>
              {offers.map(offer => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  isPopular={isPopularOffer(offer, popularThreshold)}
                />
              ))}
            </div>
          )}
          <WhatsAppBanner />
        </div>
      </main>
    </>
  )
}
