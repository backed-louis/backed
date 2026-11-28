'use client'
// Temps forts (Halloween, Black Friday, Noël) : un bandeau vert acide qui défile sous le menu, rien d'autre.
// Depuis la nouvelle identité (novembre 2026), plus d'étiquettes qui tombent, de sacs ni de scènes animées :
// le site garde son fond nuit, le bandeau suffit à marquer le moment.
// Aperçu d'une saison : ajouter ?saison=black-friday (ou halloween, noel) à l'URL.
import { useEffect } from 'react'
import { useSaisons } from '@/components/Saison'

const TEXTES: Record<string, string> = {
  'black-friday': 'BLACK FRIDAY ✦ VÉRIFIE LE CODE DE TON CRÉATEUR AVANT DE PAYER ✦ ',
  halloween: 'HALLOWEEN ✦ DES PRIX QUI FONT MOINS PEUR ✦ ',
  noel: 'NOËL ✦ LES CODES DE TES CRÉATEURS POUR TES CADEAUX ✦ ',
}

const CSS = `
.sd-band { position: fixed; top: 64px; left: 0; right: 0; height: 30px; z-index: 99; pointer-events: none; overflow: hidden;
  display: flex; align-items: center; background: var(--acid); color: var(--night); }
.sd-band-track { display: flex; white-space: nowrap; animation: sd-marquee 30s linear infinite; }
.sd-band-track span { font-family: var(--font-mono), monospace; font-weight: 800; font-size: 12px; letter-spacing: .14em; padding-right: 8px; }
@keyframes sd-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@media (prefers-reduced-motion: reduce) { .sd-band-track { animation: none } }
`

export default function SaisonDecor() {
  const s = useSaisons()[0]
  const texte = s ? TEXTES[s.id] : undefined
  useEffect(() => {
    if (!texte || !s) return
    document.documentElement.dataset.saison = s.id
    return () => { delete document.documentElement.dataset.saison }
  }, [texte, s])
  if (!texte) return null
  return (
    <div aria-hidden>
      <style>{CSS}</style>
      <div className="sd-band">
        <div className="sd-band-track">
          {[0, 1].map((k) => <span key={k}>{texte.repeat(6)}</span>)}
        </div>
      </div>
    </div>
  )
}
