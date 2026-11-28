import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'
import { getAllOffers } from '@/lib/airtable'
import { meilleurGain } from '@/lib/seo'
import Navbar from '@/components/Navbar'
import { BarreLettres, SectionLettre, Ticket, parLettre } from '@/components/AZ'

const TITRE = 'Codes promo par marque, de A à Z | Backed'
const DESCRIPTION = 'Toutes les marques qui ont un code promo partagé par un créateur YouTube, de A à Z : le nombre de codes actifs et la meilleure remise pour chacune.'

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/marques` },
  openGraph: { title: TITRE, description: DESCRIPTION, url: `${SITE_URL}/marques` },
}

export const revalidate = 3600

type MarqueListe = { name: string; slug: string; logo: string | null; count: number; gain: string }

export default async function MarquesPage() {
  const offers = await getAllOffers()
  // Une entrée par marque qui a au moins un code affiché (les autres n'ont pas de page).
  const parMarque = new Map<string, { name: string; slug: string; logo: string | null; benefits: string[] }>()
  for (const o of offers) {
    if (!o.brandSlug || !o.brand) continue
    const m = parMarque.get(o.brandSlug) ?? { name: o.brand, slug: o.brandSlug, logo: o.brandLogo, benefits: [] }
    m.benefits.push(o.benefit)
    if (!m.logo && o.brandLogo) m.logo = o.brandLogo
    parMarque.set(o.brandSlug, m)
  }
  const marques: MarqueListe[] = Array.from(parMarque.values()).map(m => ({
    name: m.name, slug: m.slug, logo: m.logo, count: m.benefits.length, gain: meilleurGain(m.benefits, 18),
  }))
  const groupes = parLettre(marques)

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          <div style={{ paddingTop: 32, marginBottom: 32 }}>
            <div className="section-label">Parcourir</div>
            <h1 style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12,
            }}>
              les <span className="hl">marques</span>
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 16 }}>
              {marques.length} marques avec un code actif, de A à Z
            </p>
          </div>
          <BarreLettres presentes={groupes.map(([l]) => l)} />
          <div style={{ paddingBottom: 96 }}>
            {groupes.map(([lettre, liste]) => (
              <SectionLettre key={lettre} lettre={lettre} n={liste.length}>
                {liste.map(m => (
                  <Ticket
                    key={m.slug}
                    href={`/marque/${m.slug}`}
                    nom={m.name}
                    image={m.logo}
                    logo
                    count={m.count}
                    droite={m.gain ? <span className="cc-gain">{m.gain}</span> : null}
                  />
                ))}
              </SectionLettre>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
