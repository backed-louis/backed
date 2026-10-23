'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { SaisonMark } from '@/components/Saison'
import { datesBlackFriday } from '@/lib/blackfriday'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  // Lien « Black Friday » dans le menu, de mi-octobre à une semaine après le Cyber Monday.
  const [bf, setBf] = useState(false)
  useEffect(() => {
    const { vendredi, cyberMonday } = datesBlackFriday()
    const t = Date.now()
    setBf(t >= vendredi.getTime() - 43 * 86400000 && t <= cyberMonday.getTime() + 7 * 86400000)
  }, [])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .nav-links { display: none !important; }
          .nav-inner { gap: 12px !important; }
          .nav-cta { padding: 8px 14px !important; font-size: 13px !important; }
          .nav-bf { padding: 7px 12px !important; font-size: 11px !important; }
          .nav-bf-on .nav-cta { display: none !important; }
        }
      `}</style>
      <nav style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        background: scrolled ? 'rgba(7,8,15,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background 0.25s, border-color 0.25s, backdrop-filter 0.25s',
      }}>
        <div className={`nav-inner${bf ? ' nav-bf-on' : ''}`} style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', width: '100%', gap: 40,
        }}>
          <Link href="/" style={{
            fontFamily: 'var(--font-syne)',
            fontSize: 20, fontWeight: 800,
            letterSpacing: '-0.02em',
            marginRight: 'auto',
            display: 'inline-flex', alignItems: 'center', position: 'relative',
          }}>
            Backed
            <SaisonMark />
          </Link>

          {bf && (
            <Link href="/black-friday" className="nav-bf" style={{
              fontSize: 12, fontWeight: 800, letterSpacing: '.06em', fontFamily: 'var(--font-syne)',
              color: '#07080F', background: '#F4F2EE', padding: '6px 12px', borderRadius: 100, whiteSpace: 'nowrap',
            }}>
              BLACK FRIDAY
            </Link>
          )}

          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {[
              { href: '/createurs', label: 'Créateurs' },
              { href: '/categories', label: 'Catégories' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
              >
                {label}
              </Link>
            ))}
          </div>

          <Link
            href="/explorer"
            className="nav-cta"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 14, fontWeight: 500,
              padding: '9px 20px',
              borderRadius: 'var(--r-md)',
              letterSpacing: '-0.01em',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
          >
            Trouver un code
          </Link>
        </div>
      </nav>
    </>
  )
}
