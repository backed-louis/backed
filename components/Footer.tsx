'use client'
import { INSTAGRAM_URL, TIKTOK_URL, YOUTUBE_URL } from '@/lib/links'
import Logo from '@/components/Logo'

export function YouTubeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2 31.4 31.4 0 000 12a31.4 31.4 0 00.5 5.8 3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1A31.4 31.4 0 0024 12a31.4 31.4 0 00-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
    </svg>
  )
}

const socialStyle = {
  width: 36, height: 36,
  borderRadius: 8,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-3)',
  transition: 'color 0.15s, border-color 0.15s',
} as const

export default function Footer() {
  const links = {
    Explorer: [
      { label: 'Toutes les offres', href: '/explorer' },
      { label: 'Créateurs', href: '/createurs' },
      { label: 'Catégories', href: '/categories' },
      { label: 'Black Friday', href: '/black-friday' },
      { label: 'Je suis créateur', href: '/rejoindre' },
    ],
    Légal: [
{ label: 'CGU', href: '/cgu' },
{ label: 'Confidentialité', href: '/confidentialite' },
      { label: 'Contact', href: 'mailto:hello.backedfr@gmail.com' },
    ],
  }

  const handleSocialEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = 'var(--text-1)'
    e.currentTarget.style.borderColor = 'var(--accent)'
  }
  const handleSocialLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = 'var(--text-3)'
    e.currentTarget.style.borderColor = 'var(--border)'
  }

  return (
    <footer style={{ padding: '56px 24px 32px', borderTop: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 40, marginBottom: 48 }}>
          <div>
            <div style={{ marginBottom: 14 }}>
              <Logo height={26} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 220, lineHeight: 1.7, marginBottom: 20 }}>
              Avant de payer, passe par Backed. Les codes promo de tes créateurs YouTube, au même endroit.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" aria-label="YouTube" style={socialStyle} onMouseEnter={handleSocialEnter} onMouseLeave={handleSocialLeave}>
                <YouTubeIcon />
              </a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={socialStyle} onMouseEnter={handleSocialEnter} onMouseLeave={handleSocialLeave}>
                <InstagramIcon />
              </a>
              <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" aria-label="TikTok" style={socialStyle} onMouseEnter={handleSocialEnter} onMouseLeave={handleSocialLeave}>
                <TikTokIcon />
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
            {Object.entries(links).map(([category, items]) => (
              <div key={category}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-4)', marginBottom: 16 }}>
                  {category}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  {items.map(({ label, href }) => (
                    <a key={label} href={href} style={{ fontSize: 13, color: 'var(--text-3)', transition: 'color 0.15s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
  
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
<span style={{ fontSize: 12, color: 'var(--text-4)' }}>© 2026 Backed · <a href="https://backed.fr" style={{ color: 'var(--text-4)', textDecoration: 'none' }}>backed.fr</a> · Tous droits réservés.</span>
          <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Fait avec ❤️ pour les communautés créateurs</span>
        </div>
      </div>
    </footer>
  )
}
