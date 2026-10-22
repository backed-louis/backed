'use client'
// Habillage saisonnier : petite icône à côté du logo (toutes les pages) et message
// sous le titre de l'accueil. Calculé dans le navigateur, à la date du jour (Paris),
// pour changer pile à minuit malgré le cache des pages.
// Aperçu d'une saison : ajouter ?saison=halloween (ou noel, black-friday, octobre-rose) à l'URL.
import { useEffect, useState } from 'react'
import { SAISONS, saisonsActives, type Saison } from '@/lib/saisons'
import SaisonIcon from '@/components/SaisonIcon'
import { SantaHat, WitchHat } from '@/components/saisons/art'

export function useSaisons(): Saison[] {
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
  const chapeau = saisons.find((x) => x.id === 'halloween' || x.id === 'noel')
  const icones = saisons.filter((x) => x !== chapeau)
  return (
    <>
      {/* chapeau posé sur le B du logo (sorcière à Halloween, Père Noël à Noël) */}
      {chapeau && (
        <span aria-hidden style={{ position: 'absolute', top: -15, left: -11, transform: 'rotate(-18deg)', animation: 'saisonIn 0.6s ease-out both', pointerEvents: 'none' }}>
          {chapeau.id === 'noel' ? <SantaHat size={28} /> : <WitchHat size={30} />}
        </span>
      )}
      {icones.length > 0 && (
        <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6, verticalAlign: 'middle' }}>
          {icones.map((x) => (
            <span key={x.id} title={x.nom} style={{ display: 'inline-flex', animation: 'saisonIn 0.5s ease-out both' }}>
              <SaisonIcon id={x.id} color={x.couleur} size={20} />
            </span>
          ))}
        </span>
      )}
      <style>{`@keyframes saisonIn { from { opacity: 0; transform: translateY(-6px) scale(0.8) rotate(-18deg); } to { opacity: 1; } }`}</style>
    </>
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

// Chapeau de saison posé sur une photo (créateurs) : bonnet de Père Noël ou chapeau de sorcière.
export function SaisonChapeau({ size = 48 }: { size?: number }) {
  const s = useSaisons().find((x) => x.id === 'noel' || x.id === 'halloween')
  if (!s) return null
  return (
    <span aria-hidden style={{
      position: 'absolute', top: -size * 0.46, left: -size * 0.2, transform: 'rotate(-22deg)',
      pointerEvents: 'none', zIndex: 1, animation: 'saisonHat 0.6s ease-out both',
    }}>
      {s.id === 'noel' ? <SantaHat size={size} /> : <WitchHat size={size * 1.08} />}
      <style>{`@keyframes saisonHat { from { opacity: 0; transform: translateY(-10px) rotate(-30deg); } to { opacity: 1; transform: rotate(-22deg); } }`}</style>
    </span>
  )
}
