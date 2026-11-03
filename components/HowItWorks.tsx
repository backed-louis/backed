'use client'

const STEPS = [
  {
    num: '01',
    title: 'Les créateurs partagent',
    desc: 'Tes créateurs glissent leurs codes promo dans leurs vidéos YouTube.',
  },
  {
    num: '02',
    title: 'On les rassemble',
    desc: 'On lit leurs descriptions et on rassemble tous les codes sur Backed.',
  },
  {
    num: '03',
    title: 'Tu paies moins',
    desc: 'Tu copies le code, tu paies moins, et tu soutiens le créateur. Sans compte.',
  },
]

export default function HowItWorks() {
  return (
    <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="container">
        <div className="section-label">En 3 étapes</div>
        <h2 className="section-title" style={{ fontFamily: 'var(--font-syne)' }}>
          Comment ça marche
        </h2>
        <p className="section-sub">Le code de ton créateur, au bon prix, en un clic.</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 2,
        }}>
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className={i === 1 ? 'pcard' : undefined}
              style={{
                padding: '40px 32px',
                borderRadius: 22,
              }}
            >
              <div className="grad" style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 56, fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                paddingBottom: 4,
                marginBottom: 20,
                alignSelf: 'flex-start',
                display: 'inline-block',
                filter: 'drop-shadow(0 0 22px rgba(139,0,255,.4))',
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
