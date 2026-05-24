'use client'
import Link from 'next/link'

interface HeroProps {
  offerCount: number
  creatorCount: number
}

export default function Hero({ offerCount, creatorCount }: HeroProps) {
  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '120px 24px 96px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '40%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 700, height: 700,
        background: 'radial-gradient(circle, rgba(139,0,255,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 760, position: 'relative' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--accent-subtle)',
          border: '1px solid var(--accent-border)',
          borderRadius: 100,
          padding: '6px 16px',
          marginBottom: 36,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--accent-text)' }}>
            🔥 +{offerCount} offres actives · +{creatorCount} créateurs soutenus
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-syne)',
          fontSize: 'clamp(40px, 7vw, 72px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          marginBottom: 24,
        }}>
          Trouvez les meilleures<br />
          <span style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 24px rgba(139,0,255,0.4))' }}>
            offres du moment.
          </span>
        </h1>

        <p style={{
          fontSize: 18,
          color: 'var(--text-2)',
          lineHeight: 1.6,
          marginBottom: 44,
          maxWidth: 500,
          margin: '0 auto 44px',
        }}>
          Codes promo vérifiés, partagés par vos créateurs préférés.
          Accès immédiat. Sans création de compte.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/explorer"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 15, fontWeight: 500,
              padding: '13px 32px',
              borderRadius: 'var(--r-md)',
              letterSpacing: '-0.01em',
              display: 'inline-block',
              boxShadow: '0 4px 20px rgba(139,0,255,0.35)',
              transition: 'background 0.15s, transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--accent-hover)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(139,0,255,0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--accent)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(139,0,255,0.35)'
            }}
          >
            Accéder aux offres
          </Link>
          <Link
            href="/createurs"
            style={{
              background: 'transparent',
              color: 'var(--text-1)',
              fontSize: 15, fontWeight: 500,
              padding: '13px 32px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border-hover)',
              display: 'inline-block',
              transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
              e.currentTarget.style.background = 'var(--bg-surface)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-hover)'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Voir les créateurs
          </Link>
        </div>
      </div>
    </section>
  )
}
