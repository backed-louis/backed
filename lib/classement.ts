// Classement « Les plus copiés » : clics des 7 derniers jours, puis clics au total.
//
// Les clics de la semaine = clics d'aujourd'hui − clics du relevé d'il y a 7 jours
// (table « Suivi quotidien », écrite chaque nuit par scripts/daily-stats.js).
//
// Les clics sont regroupés par Slug (marque + créateur) : jusqu'au 26 octobre 2026, le site
// enregistrait le clic sur la première offre trouvée avec ce slug, souvent une ancienne offre
// inactive (ex. les clics sur Cdiscount SQUEEZIE10 étaient comptés sur SQUEEZIE15). En
// regroupant, ces clics reviennent à l'offre affichée aujourd'hui pour ce créateur et cette marque.

export type ClickRecord = { id: string; slug: string; clicks: number }
export type Snapshot = { date: string; clicks: Record<string, number> }
export type ClickStats = { week: Record<string, number>; total: Record<string, number>; since: string | null }

const DAY = 86400000

// Date du jour à Paris (AAAA-MM-JJ), comme les relevés.
export function parisDate(d = new Date()) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
}

function minusDays(iso: string, n: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - n * DAY).toISOString().slice(0, 10)
}

// Relevé de référence : le plus récent qui date d'au moins 7 jours, sinon le plus ancien disponible.
export function referenceSnapshot(snapshots: Snapshot[], today = parisDate()): Snapshot | null {
  const sorted = [...snapshots].filter((s) => s.date && s.date <= today).sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return null
  const limit = minusDays(today, 7)
  const old = sorted.filter((s) => s.date <= limit)
  return old.length ? old[old.length - 1] : sorted[0]
}

export function clickStats(records: ClickRecord[], snapshots: Snapshot[], today = parisDate()): ClickStats {
  const ref = referenceSnapshot(snapshots, today)
  const week: Record<string, number> = {}
  const total: Record<string, number> = {}
  for (const r of records) {
    const key = r.slug || r.id
    total[key] = (total[key] || 0) + r.clicks
    if (ref) week[key] = (week[key] || 0) + Math.max(0, r.clicks - (ref.clicks[r.id] || 0))
  }
  return { week, total, since: ref?.date ?? null }
}

type Ranked = { brand: string; weekClicks: number; clicks: number }

// Les plus copiés cette semaine d'abord ; à égalité (ou semaine calme), les plus copiés au total.
export const parClassement = (a: Ranked, b: Ranked) =>
  b.weekClicks - a.weekClicks || b.clicks - a.clicks || a.brand.localeCompare(b.brand, 'fr')
