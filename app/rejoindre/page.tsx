import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import FormulaireCreateur from '@/components/FormulaireCreateur'

const TITRE = 'Référence ton code promo sur Backed | Créateurs'
const DESCRIPTION = 'Tu es créateur et tu as un code promo ? Envoie ta demande pour le faire référencer sur Backed.'

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/rejoindre` },
  openGraph: { title: TITRE, description: DESCRIPTION, url: `${SITE_URL}/rejoindre` },
}

export default function RejoindrePage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container" style={{ maxWidth: 680, paddingBottom: 96 }}>
          <div style={{ paddingTop: 32, marginBottom: 32 }}>
            <div className="section-label">Créateurs</div>
            <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
              Référence ton code
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 16, lineHeight: 1.7 }}>
              Tu es créateur de contenu et tu as un code promo ? Remplis ce formulaire : chaque offre est associée à son créateur, et ton code est présenté sous ton nom.
            </p>
          </div>

          <div
            role="note"
            style={{
              marginBottom: 36, padding: '16px 18px', borderRadius: 'var(--r-lg)',
              background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
              fontSize: 14, color: 'var(--text-1)', lineHeight: 1.7,
            }}
          >
            <strong>Pour l’instant, Backed ne référence que les créateurs YouTube.</strong> Les codes sont repérés dans les descriptions des vidéos. Tu publies surtout ailleurs ? Envoie ta demande quand même : elle est conservée et étudiée au cas par cas.
          </div>

          <FormulaireCreateur />
        </div>
      </main>
      <Footer />
    </>
  )
}
