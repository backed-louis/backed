import { getAllCreators, getAllOffers, getCategories, getPastOffers, type Offer } from '@/lib/airtable'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import OfferCard from '@/components/OfferCard'
import PremiumCard, { BrandTile } from '@/components/PremiumCard'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { SITE_URL } from '@/lib/links'
import { parClassement } from '@/lib/classement'
import { aujourdhui, dateLongue, gainCourt, listeCourte, listeFr, moisAnnee, pluriel } from '@/lib/seo'
import {
  CodesTable, Faq, JsonLd, LinkChips, PastCodesTable, SeoTitle,
  breadcrumbSchema, faqSchema, type FaqItem,
} from '@/components/SeoBlocks'

export const revalidate = 3600

// Pré-génère toutes les pages marque au build (rapide pour Googlebot)
export async function generateStaticParams() {
  const offers = await getAllOffers()
  const slugs = Array.from(
    new Set(offers.map(o => o.brandSlug).filter(Boolean))
  )
  return slugs.map(slug => ({ slug }))
}

// Les offres d'une marque, la meilleure d'abord : celles avec un code, puis les plus copiées.
function trier(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) =>
    Number(Boolean(b.code.trim())) - Number(Boolean(a.code.trim())) || parClassement(a, b))
}

// Récupère la marque + ses offres à partir du slug Airtable
async function getBrandData(slug: string) {
  const allOffers = await getAllOffers()
  const offers = trier(allOffers.filter(o => o.brandSlug === slug))
  if (offers.length === 0) return null

  const brand = {
    name: offers[0].brand,
    slug: offers[0].brandSlug,
    description: offers[0].brandDescription,
    logo: offers[0].brandLogo,
    website: offers[0].brandWebsite,
    category: offers[0].category,
  }
  return { brand, offers, allOffers }
}

// Titre Google : « Code promo NordVPN : -73 % (novembre 2026) | Backed ».
function titreMarque(brand: string, best: Offer, count: number, mois: string) {
  const gain = gainCourt(best.benefit)
  if (gain && gain.length <= 28) return `Code promo ${brand} : ${gain} (${mois}) | Backed`
  return `Code promo ${brand} (${mois}) : ${count} ${pluriel(count, 'offre', 'offres')} de créateurs | Backed`
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const data = await getBrandData(slug)
  if (!data) return { title: 'Marque introuvable | Backed' }

  const { brand, offers } = data
  const count = offers.length
  const mois = moisAnnee()
  const best = offers[0]
  const creators = Array.from(new Set(offers.map(o => o.creator).filter(Boolean)))
  const title = titreMarque(brand.name, best, count, mois)
  const avec = best.code ? ` ${gainCourt(best.benefit) || best.benefit} avec le code ${best.code}.` : ''
  const description = `${count} ${pluriel(count, 'code promo', 'codes promo')} ${brand.name} en ${mois}, repérés dans les vidéos de ${listeCourte(creators, 3, () => "d'autres créateurs")}.${avec} Copie-le en un clic, sans compte.`

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

  const { brand, offers, allOffers } = data
  const [creatorsList, allPast, categories] = await Promise.all([getAllCreators(), getPastOffers(), getCategories()])
  const categorySlug = categories.find(c => c.name === brand.category)?.slug || ''
  const creatorSlugs = Object.fromEntries(creatorsList.map(c => [c.name, c.slug]))
  const activeBrands = new Set(allOffers.map(o => o.brandSlug))
  const past = allPast.filter(p => p.brandSlug === brand.slug).slice(0, 8)

  const count = offers.length
  const mois = moisAnnee()
  const best = offers[0]
  const creators = Array.from(new Set(offers.map(o => o.creator).filter(Boolean)))
  const lastSeen = offers.map(o => o.seen || '').sort().pop() || null
  const site = brand.website ? brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : `le site ${brand.name}`
  const withCode = offers.filter(o => o.code.trim()).length
  const url = `${SITE_URL}/marque/${brand.slug}`

  // Mode d'emploi selon les offres : codes à copier, liens des créateurs, ou les deux.
  const howTo = withCode === 0
    ? `Clique sur « Profiter de l'offre » : tu arrives sur ${site} via le lien du créateur, et l'avantage s'applique sans code à saisir.`
    : withCode === count
      ? `Copie l'un des codes ci-dessus, va sur ${site}, ajoute tes articles au panier, puis colle le code dans le champ « code promo » au moment de payer. La réduction s'applique tout de suite.`
      : `Copie l'un des codes ci-dessus et colle-le dans le champ « code promo » sur ${site} au moment de payer. Pour les offres sans code, clique sur « Profiter de l'offre » : l'avantage s'applique via le lien du créateur.`

  const meilleur = best.code
    ? `En ${mois}, le meilleur code ${brand.name} sur Backed est ${best.code} : ${best.benefit}. Il est partagé par ${best.creator}.`
    : `En ${mois}, la meilleure offre ${brand.name} sur Backed passe par le lien de ${best.creator} : ${best.benefit}.`
  const actifs = `Oui : les ${count > 1 ? `${count} offres affichées sont actives` : 'offre affichée est active'}. Chaque code a été repéré dans une vidéo du créateur${lastSeen ? ` (dernière mention le ${dateLongue(lastSeen)})` : ''}. Un code est retiré à sa date de fin, ou automatiquement quand le créateur ne le repartage plus depuis plusieurs mois.`
  const qui = creators.length > 1
    ? `${listeFr(creators)} ont chacun leur code ${brand.name}. En utilisant le code d'un créateur, tu soutiens directement son travail.`
    : `${creators[0]} partage le code ${brand.name} référencé sur Backed. En l'utilisant, tu soutiens directement son travail.`

  const faq: FaqItem[] = [
    { q: `Quel est le meilleur code promo ${brand.name} en ce moment ?`, a: meilleur },
    { q: `Comment utiliser un code promo ${brand.name} ?`, a: howTo },
    { q: `Les codes promo ${brand.name} fonctionnent-ils encore ?`, a: actifs },
    { q: `Quels créateurs ont un code promo ${brand.name} ?`, a: qui },
  ]

  // Autres marques de la même catégorie, les plus copiées d'abord : maillage interne.
  const seenBrands = new Set([brand.slug])
  const related = [...allOffers]
    .filter(o => o.category === brand.category && o.code.trim())
    .sort(parClassement)
    .filter(o => !seenBrands.has(o.brandSlug) && seenBrands.add(o.brandSlug))
    .slice(0, 8)

  // ─── Schema Markup : ItemList des offres + FAQPage + fil d'Ariane ───
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Codes promo ${brand.name} (${mois})`,
    numberOfItems: count,
    itemListElement: offers.map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Offer',
        name: `${o.benefit} — ${brand.name}`,
        description: o.code ? `${o.benefit} avec le code ${o.code}, partagé par ${o.creator}.` : o.benefit,
        seller: { '@type': 'Organization', name: brand.name },
        ...(o.endDate ? { validThrough: o.endDate } : {}),
      },
    })),
  }

  return (
    <>
      <Navbar />
      <JsonLd data={itemListSchema} />
      <JsonLd data={faqSchema(faq)} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Backed', url: SITE_URL },
        ...(categorySlug ? [{ name: brand.category, url: `${SITE_URL}/categorie/${categorySlug}` }] : []),
        { name: `Code promo ${brand.name}`, url },
      ])} />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          {/* En-tête dans la DA des vidéos : la marque à gauche, son meilleur code en grande carte à droite */}
          <div className="brand-hero">
            <div className="brand-hero-copy">
              <BrandTile name={brand.name} logo={brand.logo} size={84} />
              <span className="kicker" style={{ marginTop: 26 }}>
                Code promo · {count} offre{count !== 1 ? 's' : ''} active{count !== 1 ? 's' : ''}
              </span>
              <h1 className="brand-hero-title">
                Code promo <span className="grad">{brand.name}</span>
              </h1>
              <p className="brand-hero-maj">
                Mis à jour le {aujourdhui()} · {pluriel(count, 'code partagé par', 'codes partagés par')} {listeCourte(creators, 3, k => `${k} ${pluriel(k, 'autre', 'autres')}`)}
              </p>
              {brand.description && <p className="brand-hero-desc">{brand.description}</p>}
              {brand.website && (
                <a href={brand.website} target="_blank" rel="noopener noreferrer" className="brand-hero-site">
                  {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗
                </a>
              )}
            </div>
            {best && (
              <div className="brand-hero-card">
                <PremiumCard offer={best} kicker="Le meilleur code" header={false} />
              </div>
            )}
          </div>

          {count > 1 && (
            <>
              <h2 className="section-title" style={{ fontFamily: 'var(--font-syne)', fontSize: 26, marginBottom: 24 }}>
                Les autres offres {brand.name}
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16, paddingBottom: 32,
              }}>
                {offers.slice(1).map(offer => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>
            </>
          )}

          {/* ─── Bloc contenu SEO ─── */}
          <section className="seo-section">
            <SeoTitle first>Tous les codes promo {brand.name} de {mois}</SeoTitle>
            <CodesTable offers={offers} col="creator" creatorSlugs={creatorSlugs} />

            <SeoTitle>Comment utiliser un code promo {brand.name} ?</SeoTitle>
            <p className="seo-p">{howTo}</p>
            <p className="seo-p">
              {`Toutes les offres ${brand.name} référencées sur Backed viennent de créateurs YouTube partenaires de la marque, qui les partagent dans la description de leurs vidéos. En utilisant le code ou le lien d'un créateur, tu soutiens directement son travail.`}
            </p>

            {past.length > 0 && (
              <>
                <SeoTitle>Anciens codes promo {brand.name}</SeoTitle>
                <p className="seo-p">
                  Ces codes ne sont plus actifs : leur date de fin est passée, ou le créateur ne les partage plus.
                  Utilise plutôt {count > 1 ? 'les codes' : 'le code'} du haut de la page.
                </p>
                <PastCodesTable past={past} col="creator" creatorSlugs={creatorSlugs} activeBrands={activeBrands} />
              </>
            )}

            <SeoTitle>Questions fréquentes</SeoTitle>
            <Faq items={faq} />

            {related.length > 0 && (
              <>
                <SeoTitle>Autres codes promo {brand.category}</SeoTitle>
                <LinkChips links={related.map(o => ({ href: `/marque/${o.brandSlug}`, label: o.brand, sub: gainCourt(o.benefit) }))} />
                {categorySlug && (
                  <p className="seo-p" style={{ marginTop: 16 }}>
                    <Link href={`/categorie/${categorySlug}`} className="seo-link">Tous les codes {brand.category} →</Link>
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
