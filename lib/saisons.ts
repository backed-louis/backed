// Habillage saisonnier du site : Octobre rose, Halloween, Black Friday, Noël…
// Chaque saison a ses dates (heure de Paris), une couleur, un petit message et une icône.
// Pour en ajouter une : une entrée dans SAISONS, et son icône dans components/SaisonIcon.tsx.

export type SaisonId = 'octobre-rose' | 'halloween' | 'black-november' | 'black-friday' | 'noel'

export interface Saison {
  id: SaisonId
  nom: string
  couleur: string
  message: string
  lien?: { href: string; label: string }
  // En cas de chevauchement (ex. Halloween pendant Octobre rose), le message affiché
  // est celui de la saison la plus prioritaire ; les icônes, elles, s'affichent toutes.
  priorite: number
  active: (d: JourParis) => boolean
}

export interface JourParis { annee: number; mois: number; jour: number }

const entre = (d: JourParis, debut: [number, number], fin: [number, number]) => {
  const v = d.mois * 100 + d.jour
  return v >= debut[0] * 100 + debut[1] && v <= fin[0] * 100 + fin[1]
}

// Black Friday : le lendemain du 4e jeudi de novembre. On l'affiche du lundi au Cyber Monday.
export function blackFriday(annee: number): Date {
  const premierNov = new Date(Date.UTC(annee, 10, 1))
  const premierJeudi = 1 + ((4 - premierNov.getUTCDay() + 7) % 7)
  return new Date(Date.UTC(annee, 10, premierJeudi + 21 + 1))
}

export const SAISONS: Saison[] = [
  {
    id: 'octobre-rose',
    nom: 'Octobre rose',
    couleur: '#FF5FA2',
    message: 'Octobre rose : dès 50 ans, le dépistage du cancer du sein, c’est tous les 2 ans.',
    lien: { href: 'https://www.ameli.fr/assure/sante/themes/cancer-sein/depistage-gratuit-50-74-ans', label: 'S’informer' },
    priorite: 1,
    active: (d) => d.mois === 10,
  },
  {
    id: 'halloween',
    nom: 'Halloween',
    couleur: '#FF8A1F',
    message: 'Halloween : des prix qui font moins peur.',
    priorite: 2,
    active: (d) => entre(d, [10, 26], [10, 31]),
  },
  {
    // Avant la semaine du Black Friday : juste l'icône et un message vers la page dédiée.
    id: 'black-november',
    nom: 'Black Friday',
    couleur: '#F4F2EE',
    message: 'Le Black Friday arrive : tous les codes des créateurs au même endroit.',
    lien: { href: '/black-friday', label: 'Voir la page' },
    priorite: 1,
    active: (d) => {
      const bf = blackFriday(d.annee)
      const t = Date.UTC(d.annee, d.mois - 1, d.jour)
      return d.mois === 11 && t < bf.getTime() - 4 * 86400000
    },
  },
  {
    id: 'black-friday',
    nom: 'Black Friday',
    couleur: '#F4F2EE',
    message: 'Black Friday : avant de payer, vérifie le code de ton créateur.',
    lien: { href: '/black-friday', label: 'Tous les codes' },
    priorite: 3,
    active: (d) => {
      const bf = blackFriday(d.annee)
      const t = Date.UTC(d.annee, d.mois - 1, d.jour)
      return t >= bf.getTime() - 4 * 86400000 && t <= bf.getTime() + 3 * 86400000
    },
  },
  {
    id: 'noel',
    nom: 'Noël',
    couleur: '#FFC94D',
    message: 'Noël : tes cadeaux moins chers, avec les codes de tes créateurs.',
    priorite: 2,
    active: (d) => entre(d, [12, 1], [12, 25]),
  },
]

export function jourParis(date = new Date()): JourParis {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(date)
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value)
  return { annee: get('year'), mois: get('month'), jour: get('day') }
}

// Saisons actives, de la plus prioritaire à la moins prioritaire.
export function saisonsActives(date = new Date()): Saison[] {
  const d = jourParis(date)
  return SAISONS.filter((s) => s.active(d)).sort((a, b) => b.priorite - a.priorite)
}
