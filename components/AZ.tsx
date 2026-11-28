// Listes de A à Z (créateurs, marques) : regroupement par lettre, barre de lettres et ticket.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { SaisonChapeau } from '@/components/Saison'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// Première lettre sans accent, en majuscule ; les noms qui commencent par un chiffre ou un symbole vont sous « # ».
export function lettreDe(nom: string): string {
  const c = nom.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
  return ALPHABET.includes(c) ? c : '#'
}

export function parLettre<T extends { name: string }>(items: T[]): [string, T[]][] {
  const groupes = new Map<string, T[]>()
  for (const it of [...items].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))) {
    const l = lettreDe(it.name)
    if (!groupes.has(l)) groupes.set(l, [])
    groupes.get(l)!.push(it)
  }
  return Array.from(groupes.entries()).sort(([a], [b]) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)))
}

export function BarreLettres({ presentes }: { presentes: string[] }) {
  const lettres = presentes.includes('#') ? ['#', ...ALPHABET] : ALPHABET
  return (
    <nav className="az-bar" aria-label="Aller à la lettre">
      {lettres.map(l => presentes.includes(l)
        ? <a key={l} href={`#lettre-${l === '#' ? '0' : l}`}>{l}</a>
        : <span key={l} aria-hidden>{l}</span>)}
    </nav>
  )
}

export function SectionLettre({ lettre, n, children }: { lettre: string; n: number; children: ReactNode }) {
  return (
    <section id={`lettre-${lettre === '#' ? '0' : lettre}`} className="az-section">
      <h2 className="az-letter"><span>{lettre}</span><i aria-hidden /><small>{n}</small></h2>
      <div className="cc-grid">{children}</div>
    </section>
  )
}

export function Ticket({ href, nom, image, logo = false, chapeau = false, count, droite }: {
  href: string; nom: string; image: string | null; logo?: boolean; chapeau?: boolean; count: number; droite: ReactNode
}) {
  return (
    <Link href={href} className="cc-card">
      <div className="cc-ticket">
        <div className="cc-avatar-wrap">
          {chapeau && <SaisonChapeau size={52} />}
          <div className={`cc-avatar${logo ? ' is-logo' : ''}`}>
            {image ? <img src={image} alt={nom} loading="lazy" /> : <span>{nom.charAt(0).toUpperCase()}</span>}
          </div>
        </div>
        <div className="cc-name">{nom}</div>
        <div className="cc-perf" aria-hidden />
        <div className="cc-foot">
          <span className="cc-count"><b>{count}</b> code{count !== 1 ? 's' : ''}</span>
          {droite}
        </div>
      </div>
    </Link>
  )
}
