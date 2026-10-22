'use client'
// Habillage saisonnier : petite icône à côté du logo (toutes les pages) et message
// sous le titre de l'accueil. Calculé dans le navigateur, à la date du jour (Paris),
// pour changer pile à minuit malgré le cache des pages.
// Aperçu d'une saison : ajouter ?saison=halloween (ou noel, black-friday, octobre-rose) à l'URL.
import { useEffect, useState } from 'react'
import { SAISONS, saisonsActives, type Saison } from '@/lib/saisons'
import SaisonIcon from '@/components/SaisonIcon'

function useSaisons(): Saison[] {
  const [saisons, setSaisons] = useState<Saison[]>([])
  useEffect(() => {
    let apercu: string | null = null
    try {
      apercu = new URLSearchParams(window.location.search).get('saison')
    } catch {}
    const forcee = SAISONS.find((s) => s.id === apercu)
    setSaisons(forcee ? [forcee] : saisonsActives())
  }, [])
  return saisons
}

export function SaisonMark() {
  const saisons = useSaisons()
  if (!saisons.length) return null
  return (
    <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6, verticalAlign: 'middle' }}>
      {saisons.map((s) => (
        <span key={s.id} title={s.nom} style={{ display: 'inline-flex', animation: 'saisonIn 0.5s ease-out both' }}>
          <SaisonIcon id={s.id} color={s.couleur} size={18} />
        </span>
      ))}
      <style>{`@keyframes saisonIn { from { opacity: 0; transform: translateY(-4px) scale(0.8); } to { opacity: 1; transform: none; } }`}</style>
    </span>
  )
}

export function SaisonNote() {
  const s = useSaisons()[0]
  if (!s) return null
  return (
    <p style={{
      fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
      marginTop: -20, marginBottom: 36, animation: 'fadeInUp 0.5s ease-out both',
    }}>
      <span style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 8 }}>
        <SaisonIcon id={s.id} color={s.couleur} size={16} />
      </span>
      {s.message}
      {s.lien && (
        <>
          {' '}
          <a href={s.lien.href} target="_blank" rel="noopener noreferrer" style={{ color: s.couleur, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {s.lien.label} →
          </a>
        </>
      )}
    </p>
  )
}

// Lueur aux couleurs de la saison derrière le titre de l'accueil, en plus du violet Backed.
export function SaisonGlow() {
  const s = useSaisons()[0]
  if (!s) return null
  return (
    <div aria-hidden style={{
      position: 'absolute', top: '32%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 900, height: 600, pointerEvents: 'none',
      background: `radial-gradient(ellipse, ${s.couleur}1A 0%, transparent 60%)`,
    }} />
  )
}
