import { getAllOffers } from '@/lib/airtable'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import OfferCard from '@/components/OfferCard'
import Navbar from '@/components/Navbar'
import WhatsAppBanner from '@/components/WhatsAppBanner'
import { SITE_URL } from '@/lib/links'

export const revalidate = 3600

// Pré-génère toutes les pages marque au build (rapide pour Googlebot)
export async function generateStaticParams() {
  const offers = await getAllOffers()
  const slugs = Array.from(
    new Set(offers.map(o => o.brandSlug).filter(Boolean))
  )
  return slugs.map(slug => ({ slug }))
}

// Récupère la marque + ses offres à partir du slug Airtable
async function getBrandData(slug: string) {
  const allOffers = await getAllOffers()
  const offers = allOffers.filter(o => o.brandSlug === slug)
  if (offers.length === 0) return null

  const brand = {
    name: offers[0].brand,
    slug: offers[0].brandSlug,
    description: offers[0].brandDescription,
    logo: offers[0].brandLogo,
    website: offers[0].brandWebsite,
    category: offers[0].category,
  }
  return { brand, offers }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const data = await getBrandData(slug)
  if (!data) return { title: 'Marque introuvable | Backed' }

  const { brand, offers } = data
  const count = offers.length
  const title = `Code promo ${brand.name} — ${count} offre${count !== 1 ? 's' : ''} active${count !== 1 ? 's' : ''} | Backed`
  const description = `Tous les codes promo et offres ${brand.name} partagés par des créateurs YouTube. ${count} offre${count !== 1 ? 's' : ''} active${count !== 1 ? 's' : ''} sur Backed. ${brand.description ? brand.description.slice(0, 100) : ''}`.trim()

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/marque/${brand.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/marque/${brand.slug}`,
      type: 'website',
    },
  }
}

export default async function MarquePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getBrandData(slug)
  if (!data) notFound()

  const { brand, offers } = data
  const count = offers.length
  const site = brand.website ? brand.website.replace(/^https?:\/\//, '') : `le site ${brand.name}`
  const withCode = offers.filter(o => o.code.trim()).length
  // Mode d'emploi selon les offres : codes à copier, liens des créateurs, ou les deux.
  const howTo = withCode === 0
    ? `Cliquez sur « Profiter de l'offre » : vous arrivez sur ${site} via le lien du créateur, et l'avantage s'applique sans code à saisir.`
    : withCode === count
      ? `Copiez l'un des codes ci-dessus, rendez-vous sur ${site}, ajoutez vos articles au panier, puis collez le code dans le champ « code promo » au moment de finaliser votre commande. La réduction s'applique immédiatement.`
      : `Copiez l'un des codes ci-dessus et collez-le dans le champ « code promo » sur ${site} au moment de payer. Pour les offres sans code, cliquez sur « Profiter de l'offre » : l'avantage s'applique via le lien du créateur.`

  // ─── Schema Markup : ItemList des offres + FAQPage ───
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Codes promo ${brand.name}`,
    numberOfItems: count,
    itemListElement: offers.map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Offer',
        name: `${o.benefit} — ${brand.name}`,
        description: o.benefit,
        seller: { '@type': 'Organization', name: brand.name },
      },
    })),
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Comment utiliser un code promo ${brand.name} ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: howTo,
        },
      },
      {
        '@type': 'Question',
        name: `D'où viennent les codes promo ${brand.name} ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Chaque code ${brand.name} référencé sur Backed est partagé par un créateur YouTube partenaire de la marque, dans la description de ses vidéos. Un code ne fonctionne plus ? Signalez-le : Backed est en bêta.`,
        },
      },
      {
        '@type': 'Question',
        name: `Combien d'offres ${brand.name} sont disponibles ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${count} offre${count !== 1 ? 's' : ''} ${brand.name} ${count !== 1 ? 'sont actuellement actives' : 'est actuellement active'} sur Backed.`,
        },
      },
    ],
  }

  return (
    <>
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
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
                <img src={brand.logo} alt={`Logo ${brand.name}`} style={{ width: 48, height: 48, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontFamily: 'var(--font-syne)', fontSize: 28, fontWeight: 800, color: 'var(--accent-text)' }}>
                  {brand.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="section-label">
              {count} offre{count !== 1 ? 's' : ''} active{count !== 1 ? 's' : ''}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12,
            }}>
              Code promo {brand.name}
            </h1>
            {brand.description && (
              <p style={{ color: 'var(--text-2)', fontSize: 16, marginBottom: 12, maxWidth: 640 }}>
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
            gap: 16, paddingBottom: 32,
          }}>
            {offers.map(offer => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>

          <WhatsAppBanner context={brand.name} />

          {/* ─── Bloc contenu SEO ─── */}
          <section style={{ maxWidth: 720, paddingBottom: 96 }}>
            <h2 style={{
              fontFamily: 'var(--font-syne)', fontSize: 24, fontWeight: 700,
              letterSpacing: '-0.02em', marginBottom: 16, marginTop: 24,
            }}>
              Comment utiliser un code promo {brand.name} ?
            </h2>
            <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
              {howTo}
            </p>
            <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
              Toutes les offres {brand.name} référencées sur Backed proviennent de créateurs
              YouTube partenaires de la marque, qui les partagent dans la description de
              leurs vidéos. En utilisant le code ou le lien d'un créateur, vous soutenez
              directement son travail.
            </p>

            <h2 style={{
              fontFamily: 'var(--font-syne)', fontSize: 24, fontWeight: 700,
              letterSpacing: '-0.02em', marginBottom: 16, marginTop: 32,
            }}>
              Questions fréquentes
            </h2>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                D'où viennent les codes promo {brand.name} ?
              </h3>
              <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
                Chaque code est partagé par un créateur YouTube partenaire de la marque,
                dans la description de ses vidéos. Un code ne fonctionne plus ? Signalez-le :
                Backed est en bêta.
              </p>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                Combien d'offres {brand.name} sont disponibles ?
              </h3>
              <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7 }}>
                {count} offre{count !== 1 ? 's' : ''} {brand.name} {count !== 1 ? 'sont actuellement actives' : 'est actuellement active'} sur Backed.
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
