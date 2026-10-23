import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL, WHATSAPP_CHANNEL_URL } from '@/lib/links'
import { getAllOffers, getCategories, type Offer } from '@/lib/airtable'
import { CATEGORIES_BF, datesBlackFriday, estBlackFriday, estCumulable, parClics } from '@/lib/blackfriday'
import { getPopularThreshold, isPopularOffer } from '@/lib/popularUtils'
import Navbar from '@/components/Navbar'
import OfferCard from '@/components/OfferCard'
import WhatsAppBanner, { WhatsAppIcon } from '@/components/WhatsAppBanner'
import CompteARebours from '@/components/CompteARebours'

export const revalidate = 3600

const dateFr = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

export async function generateMetadata(): Promise<Metadata> {
  const { annee } = datesBlackFriday()
  const title = `Codes promo Black Friday ${annee} de tes créateurs YouTube | Backed`
  const description = `Black Friday ${annee} : les codes promo partagés par tes créateurs YouTube, dont ceux qui s'ajoutent aux promos. Gratuit, sans compte.`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/black-friday` },
    openGraph: { title, description, url: `${SITE_URL}/black-friday` },
  }
}

function Grille({ offres, seuil }: { offres: Offer[]; seuil: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
      {offres.map((o) => <OfferCard key={o.id} offer={o} isPopular={isPopularOffer(o, seuil)} />)}
    </div>
  )
}

function Titre({ kicker, titre, sous }: { kicker: string; titre: string; sous?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-label">{kicker}</div>
      <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>{titre}</h2>
      {sous && <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 640 }}>{sous}</p>}
    </div>
  )
}

export default async function BlackFridayPage() {
  const [offres, categories] = await Promise.all([getAllOffers(), getCategories()])
  const { annee, vendredi, debutSemaine, cyberMonday } = datesBlackFriday()
  const seuil = getPopularThreshold(offres)

  const bf = offres.filter(estBlackFriday).sort(parClics)
  const cumulables = offres.filter((o) => estCumulable(o) && !estBlackFriday(o)).sort(parClics)
  const parCategorie = CATEGORIES_BF
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ cat: c, offres: offres.filter((o) => o.category === c.name && !estBlackFriday(o) && !estCumulable(o)).sort(parClics).slice(0, 6) }))
    .filter((x) => x.offres.length > 0)

  const faq = [
    {
      q: `Quand a lieu le Black Friday ${annee} ?`,
      r: `Le Black Friday ${annee} tombe le ${dateFr(vendredi)}, et le Cyber Monday le ${dateFr(cyberMonday)}. Beaucoup de marques lancent leurs offres dès le ${dateFr(debutSemaine)}, parfois dès le début du mois de novembre.`,
    },
    {
      q: 'Les codes des créateurs sont-ils cumulables avec les promos du Black Friday ?',
      r: 'Ça dépend de la marque. Certains codes sont prévus pour s’ajouter aux prix déjà réduits (par exemple « 10 % en plus sur les produits déjà en promo ») : on les regroupe sur cette page. Pour les autres, vérifie les conditions sur le site de la marque au moment de payer.',
    },
    {
      q: 'Comment utiliser un code créateur pendant le Black Friday ?',
      r: 'Copie le code sur Backed, ajoute tes articles au panier sur le site de la marque, puis colle le code dans le champ « code promo » avant de payer. Pour les offres sans code, clique sur « Profiter de l’offre » : l’avantage passe par le lien du créateur.',
    },
    {
      q: 'Pourquoi passer par le code d’un créateur ?',
      r: 'Tu paies moins, et la marque sait que c’est ce créateur qui t’a amené : tu soutiens directement son travail, sans rien payer de plus.',
    },
  ]

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
  }

  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main style={{ paddingTop: 64, minHeight: '100vh' }}>
        {/* ─── En-tête ─── */}
        <section style={{ position: 'relative', overflow: 'hidden', padding: '72px 24px 64px', textAlign: 'center', background: 'linear-gradient(180deg, #000 0%, var(--bg-base) 100%)', borderBottom: '1px solid var(--border)' }}>
          <div aria-hidden style={{ position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%) rotate(-8deg)', whiteSpace: 'nowrap', fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 'clamp(80px, 16vw, 220px)', letterSpacing: '-0.02em', color: 'transparent', WebkitTextStroke: '1.5px rgba(244,242,238,.08)', pointerEvents: 'none' }}>BLACK FRIDAY</div>
          <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: '#000', background: '#F4F2EE', padding: '6px 14px', borderRadius: 100, marginBottom: 24 }}>
              BLACK FRIDAY · {vendredi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase()}
            </div>
            <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 'clamp(36px, 6.5vw, 66px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 18 }}>
              Les codes Black Friday<br />de tes <span style={{ color: 'var(--accent)' }}>créateurs.</span>
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 17, lineHeight: 1.6, maxWidth: 560, margin: '0 auto 32px' }}>
              Avant de payer, vérifie le code de ton créateur : sur certaines marques, il s’ajoute même aux promos du Black Friday.
            </p>
            <div style={{ marginBottom: 32 }}>
              <CompteARebours vendredi={vendredi.toISOString()} cyberMonday={cyberMonday.toISOString()} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25D366', color: '#07080F', fontWeight: 600, fontSize: 15, padding: '13px 24px', borderRadius: 'var(--r-md)' }}>
                <WhatsAppIcon /> Reçois les codes Black Friday
              </a>
              <a href="#codes" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-1)', fontWeight: 500, fontSize: 15, padding: '13px 24px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-hover)' }}>
                Voir les codes ↓
              </a>
            </div>
          </div>
        </section>

        <div className="container" id="codes" style={{ paddingTop: 64, paddingBottom: 32 }}>
          {/* ─── Codes Black Friday ─── */}
          <section style={{ marginBottom: 72 }}>
            <Titre kicker={`${bf.length} code${bf.length > 1 ? 's' : ''} Black Friday`} titre="Les codes Black Friday des créateurs"
              sous="Les codes que les créateurs partagent spécialement pour le Black Friday et le Cyber Monday." />
            {bf.length ? <Grille offres={bf} seuil={seuil} /> : (
              <div style={{ padding: '32px 24px', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border-hover)', background: 'var(--bg-card)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Les premiers codes Black Friday arrivent en novembre.</p>
                <p style={{ color: 'var(--text-2)', fontSize: 15, marginBottom: 20 }}>On les ajoute ici dès qu’un créateur les partage dans une vidéo.</p>
                <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#25D366', fontWeight: 600 }}>
                  <WhatsAppIcon /> Être prévenu sur WhatsApp →
                </a>
              </div>
            )}
          </section>

          {/* ─── Cumulables ─── */}
          {cumulables.length > 0 && (
            <section style={{ marginBottom: 72 }}>
              <Titre kicker="En plus des promos" titre="Ils s’ajoutent aux prix déjà réduits"
                sous="Ces codes donnent une réduction supplémentaire sur les produits déjà en promo, selon les conditions de la marque : idéal pour le Black Friday." />
              <Grille offres={cumulables} seuil={seuil} />
            </section>
          )}

          {/* ─── Par catégorie ─── */}
          {parCategorie.map(({ cat, offres: liste }) => (
            <section key={cat.id} style={{ marginBottom: 64 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <Titre kicker="Les plus copiés" titre={cat.name} />
                <Link href={`/categorie/${cat.slug}`} style={{ color: 'var(--accent-text)', fontWeight: 600, fontSize: 14, marginBottom: 28 }}>
                  Tous les codes {cat.name} →
                </Link>
              </div>
              <Grille offres={liste} seuil={seuil} />
            </section>
          ))}

          <WhatsAppBanner />

          {/* ─── FAQ ─── */}
          <section style={{ maxWidth: 760, paddingBottom: 96 }}>
            <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 24 }}>Questions fréquentes</h2>
            {faq.map((f) => (
              <details key={f.q} style={{ borderTop: '1px solid var(--border)', padding: '18px 0' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>{f.q}</summary>
                <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, marginTop: 12 }}>{f.r}</p>
              </details>
            ))}
          </section>
        </div>
      </main>
    </>
  )
}
