'use client'

const STEPS = [
  {
    num: '01',
    title: 'Les créateurs partagent',
    desc: 'Vos créateurs préférés diffusent leurs codes promo via leurs contenus YouTube, comme d\'habitude.',
  },
  {
    num: '02',
    title: 'Backed vérifie',
    desc: 'Chaque offre est référencée et vérifiée pour garantir qu\'elle soit active et propose les meilleures conditions.',
  },
  {
    num: '03',
    title: 'Vous profitez',
    desc: 'Accès immédiat au code. Sans création de compte. Sans friction.',
  },
]

export default function HowItWorks() {
  return (
    <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="container">
        <div className="section-label">Le concept</div>
        <h2 className="section-title" style={{ fontFamily: 'var(--font-syne)' }}>
          La différence Backed
        </h2>
        <p className="section-sub">Des offres vérifiées. Un soutien direct aux créateurs.</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 2,
        }}>
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              style={{
                padding: '40px 32px',
                background: i === 1 ? 'var(--bg-surface)' : 'transparent',
                borderRadius: i === 1 ? 'var(--r-xl)' : 0,
                border: i === 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 52, fontWeight: 800,
                color: 'var(--accent)',
                opacity: 0.2,
                lineHeight: 1,
                marginBottom: 24,
              }}>
                {step.num}
              </div>
              <h3 style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 20, fontWeight: 700,
                letterSpacing: '-0.01em',
                marginBottom: 12,
              }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
