'use client'

const STEPS = [
  {
    num: '01',
    title: 'Les créateurs partagent',
    desc: 'Tes créateurs glissent leurs codes promo dans leurs vidéos YouTube et Twitch.',
  },
  {
    num: '02',
    title: 'On met à jour chaque nuit',
    desc: 'Chaque nuit, on lit leurs descriptions et on met les codes à jour sur Backed.',
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
