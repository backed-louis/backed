'use client'
// Filet de sécurité : si une page n'arrive pas à charger ses données (Airtable
// momentanément indisponible), on affiche une page Backed avec un bouton pour
// réessayer, au lieu de l'écran d'erreur générique de Next.js.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  const retry = () => {
    router.refresh()
    reset()
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, minHeight: '100vh' }}>
        <div className="container" style={{ textAlign: 'center', padding: '120px 24px' }}>
          <h1 style={{
            fontFamily: 'var(--font-syne)',
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 12,
          }}>
            Cette page met du temps à charger.
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 16, marginBottom: 32 }}>
            Réessaie dans quelques secondes, les codes arrivent.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={retry}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 15, fontWeight: 500,
                padding: '13px 32px',
                borderRadius: 'var(--r-md)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(139,0,255,0.35)',
              }}
            >
              Réessayer
            </button>
            <Link
              href="/explorer"
              style={{
                color: 'var(--text-1)',
                fontSize: 15, fontWeight: 500,
                padding: '13px 32px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
              }}
            >
              Voir tous les codes
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
