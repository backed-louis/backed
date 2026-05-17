'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
      height: 64,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      background: scrolled ? 'rgba(7,8,15,0.88)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      transition: 'background 0.25s, border-color 0.25s, backdrop-filter 0.25s',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', width: '100%', gap: 40,
      }}>
        {/* Logo */}
        <Link href="/" style={{
          fontFamily: 'var(--font-syne)',
          fontSize: 20, fontWeight: 800,
          letterSpacing: '-0.02em',
          marginRight: 'auto',
        }}>
          Backed
        </Link>

        {/* Liens */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
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

        {/* CTA */}
        <Link
          href="/explorer"
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
          Accéder aux offres
        </Link>
      </div>
    </nav>
  )
}
