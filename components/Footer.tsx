'use client'

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

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
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
    ],
    Légal: [
      { label: 'CGU', href: '#' },
      { label: 'Confidentialité', href: '#' },
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
            <div style={{ fontFamily: 'var(--font-syne)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>
              Backed
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 220, lineHeight: 1.7, marginBottom: 20 }}>
              Les meilleurs codes promo des créateurs que tu suis. Vérifiés. Toujours actifs.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="https://instagram.com/backedfr" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={socialStyle} onMouseEnter={handleSocialEnter} onMouseLeave={handleSocialLeave}>
                <InstagramIcon />
              </a>
              <a href="https://tiktok.com/@backedfr" target="_blank" rel="noopener noreferrer" aria-label="TikTok" style={socialStyle} onMouseEnter={handleSocialEnter} onMouseLeave={handleSocialLeave}>
                <TikTokIcon />
              </a>
              <a href="https://whatsapp.com/channel/0029VbCzNIoGehEN4EMwe70h" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" style={socialStyle} onMouseEnter={handleSocialEnter} onMouseLeave={handleSocialLeave}>
                <WhatsAppIcon />
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
          <span style={{ fontSize: 12, color: 'var(--text-4)' }}>© 2026 Backed. Tous droits réservés.</span>
          <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Fait avec ❤️ pour les communautés créateurs</span>
        </div>
      </div>
    </footer>
  )
}
