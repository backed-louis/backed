import { getAllCreators, getAllOffers, getPastOffers, type Offer } from '@/lib/airtable'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'
import OfferCard from '@/components/OfferCard'
import Navbar from '@/components/Navbar'
import { SaisonChapeau } from '@/components/Saison'
import { getPopularThreshold, isPopularOffer } from '@/lib/popularUtils'
import { parClassement } from '@/lib/classement'
import { aujourdhui, dateLongue, gainCourt, listeFr, moisAnnee, pluriel } from '@/lib/seo'
import {
  CodesTable, Faq, JsonLd, LinkChips, PastCodesTable, SeoTitle,
  breadcrumbSchema, faqSchema, type FaqItem,
} from '@/components/SeoBlocks'

export const revalidate = 3600

// Les offres d'un créateur, la meilleure d'abord : celles avec un code, puis les plus copiées.
function trier(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) =>
    Number(Boolean(b.code.trim())) - Number(Boolean(a.code.trim())) || parClassement(a, b))
}

async function getCreatorData(slug: string) {
  const [creators, allOffers] = await Promise.all([getAllCreators(), getAllOffers()])
  const creator = creators.find(c => c.slug === slug)
  if (!creator) return null
  const offers = trier(allOffers.filter(o => o.creator === creator.name))
  return { creator, creators, offers, allOffers }
}

// Titre Google : « Code promo Squeezie : NordVPN, Cdiscount (novembre 2026) | Backed »,
// pour les recherches « code Squeezie ».
function titreCreateur(name: string, brands: string[], mois: string) {
  if (!brands.length) return `Codes promo de ${name} | Backed`
  for (const n of [3, 2, 1]) {
    const shown = brands.slice(0, n)
    const t = `Code promo ${name} : ${shown.join(', ')}${brands.length > n ? '…' : ''} (${mois}) | Backed`
    if (t.length <= 70 || n === 1) return t
  }
  return `Code promo ${name} (${mois}) | Backed`
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const data = await getCreatorData(slug)
  if (!data) return { title: 'Créateur introuvable | Backed' }

  const { creator, offers } = data
  const count = offers.length
  const mois = moisAnnee()
  const brands = Array.from(new Set(offers.map(o => o.brand)))
  const title = titreCreateur(creator.name, brands, mois)
  const best = offers[0]
  const description = count
    ? `Les ${count > 1 ? `${count} codes promo` : 'codes promo'} de ${creator.name} en ${mois} : ${listeFr(brands.slice(0, 4))}${brands.length > 4 ? '…' : ''}.${best?.code ? ` ${gainCourt(best.benefit) || best.benefit} chez ${best.brand} avec le code ${best.code}.` : ''} Copie son code et soutiens ${creator.name}. Gratuit, sans compte.`
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
  const data = await getCreatorData(slug)
  if (!data) notFound()

  const { creator, creators, offers, allOffers } = data
  const allPast = await getPastOffers()
  const popularThreshold = getPopularThreshold(allOffers)
  const creatorSlugs = Object.fromEntries(creators.map(c => [c.name, c.slug]))
  const activeBrands = new Set(allOffers.map(o => o.brandSlug))
  const past = allPast.filter(p => p.creator === creator.name).slice(0, 8)

  const count = offers.length
  const mois = moisAnnee()
  const brands = Array.from(new Set(offers.map(o => o.brand)))
  const withCode = offers.filter(o => o.code.trim())
  const lastSeen = offers.map(o => o.seen || '').sort().pop() || null
  const url = `${SITE_URL}/createur/${creator.slug}`
  const channel = creator.channelId ? `https://www.youtube.com/channel/${creator.channelId}` : null

  const liste = withCode.slice(0, 6).map(o => `${o.code} chez ${o.brand} (${gainCourt(o.benefit) || o.benefit})`)
  const quelCode = withCode.length === 0
    ? `${creator.name} partage ${count > 1 ? 'des liens' : 'un lien'} chez ${listeFr(brands)} : l'avantage s'applique en passant par son lien, sans code à saisir.`
    : withCode.length === 1
      ? `En ${mois}, ${creator.name} partage le code ${withCode[0].code} chez ${withCode[0].brand} : ${withCode[0].benefit}.`
      : `En ${mois}, ${creator.name} partage ${withCode.length} codes promo : ${listeFr(liste)}${withCode.length > 6 ? ', et d\'autres plus haut sur la page' : ''}.`
  const actifs = `Oui : ${count > 1 ? `les ${count} offres affichées sont actives` : "l'offre affichée est active"}. Chaque code a été repéré dans une vidéo récente de ${creator.name}${lastSeen ? ` (dernière mention le ${dateLongue(lastSeen)})` : ''}. Backed retire un code à sa date de fin, ou 3 mois après sa dernière mention.`
  const soutenir = `Utilise son code ou son lien quand tu commandes chez ${brands.length > 1 ? 'une de ses marques partenaires' : brands[0] || 'sa marque partenaire'} : la marque sait que tu viens de la part de ${creator.name}, et c'est ce qui compte pour ses partenariats. Tu ne paies rien de plus, au contraire.`

  const faq: FaqItem[] = count ? [
    { q: `Quel est le code promo de ${creator.name} ?`, a: quelCode },
    { q: `Les codes de ${creator.name} fonctionnent-ils encore ?`, a: actifs },
    { q: `Comment soutenir ${creator.name} avec ses codes promo ?`, a: soutenir },
  ] : []

  // Créateurs qui ont un code chez les mêmes marques : maillage interne entre pages créateurs.
  const myBrands = new Set(offers.map(o => o.brandSlug))
  const relatedNames = Array.from(new Set(
    [...allOffers].sort(parClassement)
      .filter(o => myBrands.has(o.brandSlug) && o.creator && o.creator !== creator.name)
      .map(o => o.creator)
  )).filter(n => creatorSlugs[n]).slice(0, 8)

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Codes promo de ${creator.name} (${mois})`,
    numberOfItems: count,
    itemListElement: offers.map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Offer',
        name: `${o.benefit} — ${o.brand}`,
        description: o.code ? `${o.benefit} avec le code ${o.code}, partagé par ${creator.name}.` : o.benefit,
        seller: { '@type': 'Organization', name: o.brand },
        ...(o.endDate ? { validThrough: o.endDate } : {}),
      },
    })),
  }
  const profileSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    mainEntity: {
      '@type': 'Person',
      name: creator.name,
      ...(creator.avatar ? { image: creator.avatar } : {}),
      ...(channel ? { sameAs: [channel] } : {}),
    },
  }

  return (
    <>
      <Navbar />
      {count > 0 && <JsonLd data={itemListSchema} />}
      {faq.length > 0 && <JsonLd data={faqSchema(faq)} />}
      <JsonLd data={profileSchema} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Backed', url: SITE_URL },
        { name: 'Créateurs', url: `${SITE_URL}/createurs` },
        { name: creator.name, url },
      ])} />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          <div style={{ paddingTop: 32, marginBottom: 48 }}>
            <div style={{ position: 'relative', width: 72, marginBottom: 20 }}>
            <SaisonChapeau size={50} />
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid var(--accent-border)',
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
            </div>
            <div className="section-label">
              Codes promo · {count} offre{count !== 1 ? 's' : ''} active{count !== 1 ? 's' : ''}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.05,
            }}>
              Les codes promo de <span className="grad">{creator.name}</span>
            </h1>
            {count > 0 && (
              <p className="brand-hero-maj" style={{ marginBottom: 16 }}>
                Mis à jour le {aujourdhui()} · {count} {pluriel(count, 'offre', 'offres')} chez {listeFr(brands.slice(0, 4))}{brands.length > 4 ? ` et ${brands.length - 4} autre${brands.length - 4 > 1 ? 's' : ''} marque${brands.length - 4 > 1 ? 's' : ''}` : ''}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
              {channel && (
                <a href={channel} target="_blank" rel="noopener noreferrer" className="brand-hero-site" style={{ marginLeft: 6 }}>
                  Sa chaîne YouTube ↗
                </a>
              )}
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

          {(count > 0 || past.length > 0) && (
            <section className="seo-section">
              {count > 0 && (
                <>
                  <SeoTitle first>Tous les codes de {creator.name} en {mois}</SeoTitle>
                  <CodesTable offers={offers} col="brand" creatorSlugs={creatorSlugs} />
                </>
              )}

              {past.length > 0 && (
                <>
                  <SeoTitle first={count === 0}>Anciens codes de {creator.name}</SeoTitle>
                  <p className="seo-p">
                    Ces codes ne sont plus actifs : leur date de fin est passée, ou {creator.name} ne les partage plus.
                  </p>
                  <PastCodesTable past={past} col="brand" creatorSlugs={creatorSlugs} activeBrands={activeBrands} />
                </>
              )}

              {faq.length > 0 && (
                <>
                  <SeoTitle>Questions fréquentes</SeoTitle>
                  <Faq items={faq} />
                </>
              )}

              {relatedNames.length > 0 && (
                <>
                  <SeoTitle>D&apos;autres créateurs chez les mêmes marques</SeoTitle>
                  <LinkChips links={relatedNames.map(n => ({ href: `/createur/${creatorSlugs[n]}`, label: n }))} />
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  )
}
