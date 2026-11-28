import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'
import { getAllCreators, getAllOffers } from '@/lib/airtable'
import Navbar from '@/components/Navbar'
import { BarreLettres, SectionLettre, Ticket, parLettre } from '@/components/AZ'

export const metadata: Metadata = {
  title: "Les créateurs YouTube et leurs codes promo | Backed",
  description: "Retrouve les codes promo de tes créateurs YouTube préférés : Squeezie, Inoxtag, Mcfly et Carlito et bien d'autres.",
  alternates: { canonical: `${SITE_URL}/createurs` },
  openGraph: { title: "Les créateurs YouTube et leurs codes promo | Backed", description: "Retrouve les codes promo de tes créateurs YouTube préférés : Squeezie, Inoxtag, Mcfly et Carlito et bien d'autres.", url: `${SITE_URL}/createurs` },
}


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
  const groupes = parLettre(creatorsWithOffers)
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container">
          <div style={{ paddingTop: 32, marginBottom: 32 }}>
            <div className="section-label">Communauté</div>
            <h1 style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12,
            }}>
              les <span className="hl">créateurs</span>
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 16 }}>
              {creatorsWithOffers.length} créateurs actifs, de A à Z, leurs codes vérifiés et à jour
            </p>
          </div>
          <BarreLettres presentes={groupes.map(([l]) => l)} />
          <div style={{ paddingBottom: 96 }}>
            {groupes.map(([lettre, liste]) => (
              <SectionLettre key={lettre} lettre={lettre} n={liste.length}>
                {liste.map(creator => (
                  <Ticket
                    key={creator.id}
                    href={`/createur/${creator.slug}`}
                    nom={creator.name}
                    image={creator.avatar}
                    chapeau
                    count={offerCounts[creator.name] || 0}
                    droite={
                      <span className="cc-platforms">
                        {creator.platforms.map(p => (
                          <span key={p} className={`cc-pf cc-pf-${p.toLowerCase()}`}>{p.toLowerCase()}</span>
                        ))}
                      </span>
                    }
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
