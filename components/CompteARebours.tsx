'use client'
// Compte à rebours jusqu'au Black Friday (et messages pendant la semaine).
import { useEffect, useState } from 'react'

const JOUR = 86400000

export default function CompteARebours({ vendredi, cyberMonday }: { vendredi: string; cyberMonday: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // Minuit à Paris (UTC+1 en novembre).
  const bf = new Date(vendredi).getTime() - 3600000
  const cm = new Date(cyberMonday).getTime() - 3600000
  if (now === null) return <div style={{ height: 92 }} />

  if (now >= cm + JOUR) {
    return <p style={msg}>Le Black Friday est terminé. Tous les codes des créateurs restent sur Backed.</p>
  }
  if (now >= cm) return <p style={msg}>C'est le Cyber Monday : dernier jour pour en profiter.</p>
  if (now >= bf + JOUR) return <p style={msg}>Le week-end du Black Friday continue, jusqu'au Cyber Monday.</p>
  if (now >= bf) return <p style={msg}>C'est aujourd'hui : le Black Friday a commencé.</p>

  const reste = bf - now
  const cases = [
    { v: Math.floor(reste / JOUR), l: 'jours' },
    { v: Math.floor((reste % JOUR) / 3600000), l: 'heures' },
    { v: Math.floor((reste % 3600000) / 60000), l: 'minutes' },
  ]
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }} aria-label={`Black Friday dans ${cases[0].v} jours`}>
      {cases.map((c) => (
        <div key={c.l} style={{ minWidth: 86, padding: '12px 10px', borderRadius: 'var(--r-lg)', background: '#000', border: '1px solid rgba(255,255,255,.16)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 34, lineHeight: 1, color: '#F4F2EE' }}>{String(c.v).padStart(2, '0')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>{c.l}</div>
        </div>
      ))}
    </div>
  )
}

const msg: React.CSSProperties = { fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 20, color: '#F4F2EE' }
