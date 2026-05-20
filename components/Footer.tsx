'use client'

export default function Footer() {
  const links = {
    Explorer: ['Toutes les offres', 'Créateurs', 'Catégories'],
    Légal: ['CGU', 'Confidentialité', 'Contact'],
  }

  return (
    <footer style={{ padding: '56px 24px 32px', borderTop: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 40,
          marginBottom: 48,
        }}>
          {/* Brand */}
          <div>
            <div style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 20, fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: 10,
            }}>
              Backed
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 220, lineHeight: 1.7 }}>
              Les meilleurs codes promo des créateurs que tu suis. Vérifiés. Toujours actifs.
            </p>
          </div>

          {/* Liens */}
          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
            {Object.entries(links).map(([category, items]) => (
              <div key={category}>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--text-4)',
                  marginBottom: 16,
                }}>
                  {category}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  {items.map(item => (
                    <a
                      key={item}
                      href="#"
                      style={{ fontSize: 13, color: 'var(--text-3)', transition: 'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
            © 2026 Backed. Tous droits réservés.
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
            Fait avec ❤️ pour les communautés créateurs
          </span>
        </div>
      </div>
    </footer>
  )
}
