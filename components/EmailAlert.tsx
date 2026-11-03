'use client'
import { WhatsAppIcon } from '@/components/WhatsAppBanner'
import { WHATSAPP_CHANNEL_URL } from '@/lib/links'

const ctaStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--accent)',
  boxShadow: '0 0 0 1px rgba(214,180,255,.35) inset, 0 10px 34px rgba(139,0,255,.45)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  padding: '13px 28px',
  borderRadius: '12px',
  letterSpacing: '-0.01em',
  textDecoration: 'none',
}

export default function EmailAlert() {
  return (
    <section style={{ padding: '96px 24px', background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(139,0,255,.16), transparent 70%), rgba(12,14,26,.55)', borderTop: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>💬</div>
<h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
  1 code par jour,<br />
  <span className="grad" style={{ filter: 'drop-shadow(0 0 26px rgba(139,0,255,.45))' }}>sur WhatsApp.</span>
</h2>
        <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 36, lineHeight: 1.6 }}>
          ⚡ Le meilleur code du jour, à 12h15. Rien d'autre.
        </p>
        <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={ctaStyle}>
          <WhatsAppIcon />
          Rejoindre la chaîne
        </a>
      </div>
    </section>
  )
}
