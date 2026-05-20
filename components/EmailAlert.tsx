'use client'
import { useState } from 'react'

export default function EmailAlert() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) setSubmitted(true)
    // TODO: connecter à Brevo / Mailchimp
  }

  return (
    <section style={{
      padding: '96px 24px',
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{
          fontFamily: 'var(--font-syne)',
          fontSize: 'clamp(22px, 4vw, 32px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          marginBottom: 14,
        }}>
          Tu veux recevoir les nouveaux codes<br />avant les autres ?
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 36 }}>
          Être alerté dès qu'un nouveau code arrive.
        </p>

        {submitted ? (
          <div style={{
            background: 'rgba(52,199,89,0.08)',
            border: '1px solid rgba(52,199,89,0.22)',
            borderRadius: 'var(--r-lg)',
            padding: '16px 24px',
            color: '#4CD964',
            fontSize: 14, fontWeight: 500,
          }}>
            ✓ Tu es sur la liste. On t'alertera en premier.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', gap: 8, maxWidth: 420, margin: '0 auto', flexWrap: 'wrap' }}
          >
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              style={{
                flex: 1, minWidth: 200,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                color: 'var(--text-1)',
                fontSize: 14,
                padding: '11px 16px',
                outline: 'none',
                fontFamily: 'var(--font-inter)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,0,255,0.4)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <button
              type="submit"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 14, fontWeight: 500,
                padding: '11px 24px',
                borderRadius: 'var(--r-md)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-inter)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
            >
              M'alerter
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
