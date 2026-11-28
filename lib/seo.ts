// Petits outils pour les titres et les textes des pages marques et créateurs (référencement Google).

const TZ = 'Europe/Paris'

// « novembre 2026 » : le mois en cours à Paris. Les pages sont régénérées chaque heure,
// donc le mois des titres change tout seul le 1er.
export function moisAnnee(d = new Date()): string {
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: TZ })
}

// « 24 novembre 2026 » à partir d'une date AAAA-MM-JJ (ou d'un horodatage ISO).
export function dateLongue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })
}

// « 24 nov. 2026 », pour les tableaux.
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
}

// Date du jour à Paris, en toutes lettres : la date de mise à jour affichée sur les pages.
export function aujourdhui(): string {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })
}

// Première proposition lisible d'un avantage (même règle que les vidéos, scripts/reels/render.py).
function premiereProposition(text: string): string {
  let t = (text || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  for (const sep of [' + ', ', ', '; ', ' et ', ' puis ']) {
    const head = t.split(sep)[0]
    if (head.length >= 8 && head.length < t.length) t = head
  }
  return t
}

// L'avantage en quelques mots, pour les titres : « -20 % », « -10 € », « Jusqu'à -85 € »,
// « 1 mois offert ». Même logique que les couvertures des vidéos (scripts/reels/couverture.py).
export function gainCourt(benefit: string, max = 28): string {
  let t = premiereProposition(benefit)
  t = t.replace(/(\d)\s?(%|€)/g, '$1 $2')
  const reduc = / de réduction/i.test(t)
  const head = t.split(' sur ')[0]
  if (head !== t && /^-?\d+([.,]\d+)? (%|€)$/.test(head)) t = head // « -22 € sur la MagGo » → « -22 € »
  if (t.length > max) {
    let cut = false
    for (const sep of [' de réduction', ' pour ', ' sur ', ' avec ', ' à partir ', ' dès ', ' chez ', ' pendant ',
      ' lors ', ' en ', ' via ', " à l'", ' à la ', " jusqu'au "]) {
      const h = t.split(sep)[0].trim()
      if (h !== t && h.length <= max && (/\d/.test(h) || h.length >= 14)) { t = h; cut = true; break }
    }
    if (!cut) {
      // Coupé à la fin d'un mot, sans finir sur un chiffre seul ou un petit mot (« … programme 100 »).
      const words = t.slice(0, max + 1).split(' ').slice(0, -1)
      while (words.length > 1 && /^(\d+([.,]\d+)?|%|€|\+|de|du|des|à|la|le|les|en|sur|pour|avec|et|ou)$/i.test(words[words.length - 1])) words.pop()
      t = words.join(' ')
    }
  }
  t = t.replace(/ de réduction/i, '').replace(/[ .,;:]+$/, '')
  if (/^\d+([.,]\d+)? %$/.test(t)) t = `-${t}` // « 15 % » seul est une remise
  if (reduc) t = t.replace(/^(Jusqu'à|jusqu'à)\s+(\d)/, '$1 -$2') // « Jusqu'à 85 € de réduction » → « Jusqu'à -85 € »
  return t
}

// Avantage concret et chiffré (même filtre que lib/airtable.ts) : sert à écarter les anciens
// codes sans intérêt (« Offre spéciale », « Participation au jeu concours »).
export const AVANTAGE = /\d+([.,]\d+)?\s?(%|€|euros?\b|mois\b|jours?\b|ans?\b|go\b)|offert|gratuit|essai/i

// « Squeezie », « Squeezie et Gotaga », « Squeezie, Gotaga et Inoxtag »
export function listeFr(items: string[]): string {
  if (items.length <= 1) return items[0] || ''
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`
}

// « A, B, C et 2 autres » : les premiers éléments, puis le nombre restant.
export function listeCourte(items: string[], n: number, autres: (k: number) => string): string {
  if (items.length <= n) return listeFr(items)
  return `${items.slice(0, n).join(', ')} et ${autres(items.length - n)}`
}

export function pluriel(n: number, un: string, plusieurs: string): string {
  return n > 1 ? plusieurs : un
}
