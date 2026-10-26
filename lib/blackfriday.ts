// Page Black Friday : dates de l'année et sélection des offres.
import { blackFriday } from '@/lib/saisons'
import type { Offer } from '@/lib/airtable'
import { parClassement } from '@/lib/classement'

const JOUR = 86400000

// Année ciblée : celle de cette année jusqu'à 2 semaines après le Cyber Monday, puis la suivante.
export function datesBlackFriday(maintenant = new Date()) {
  let annee = maintenant.getUTCFullYear()
  if (maintenant.getTime() > blackFriday(annee).getTime() + 17 * JOUR) annee++
  const vendredi = blackFriday(annee)
  return {
    annee,
    vendredi,
    debutSemaine: new Date(vendredi.getTime() - 4 * JOUR),
    cyberMonday: new Date(vendredi.getTime() + 3 * JOUR),
  }
}

// Offres Black Friday : cochées dans Airtable, ou qui en parlent dans leur texte.
const BF = /black\s*friday|black\s*friyay|black\s*week|black\s*november|cyber\s*monday|\bbf\b/i
export const estBlackFriday = (o: Offer) => o.blackFriday || BF.test(`${o.benefit} ${o.code}`)

// Codes qui s'ajoutent aux prix déjà réduits (« 10 % en plus sur les produits déjà en promo »).
// (« 4 mois supplémentaires » ou un bonus de jeu ne comptent pas : il faut une référence aux promos.)
const CUMUL = /cumulable|(en plus|suppl[ée]mentaires?)[^.]{0,60}(promo|r[ée]duit|soldes|remis)|d[ée]j[àa] (en promo|r[ée]duit|remis)/i
export const estCumulable = (o: Offer) => CUMUL.test(o.benefit)

// Catégories où l'on achète le plus pendant le Black Friday.
export const CATEGORIES_BF = ['tech-gaming', 'ecommerce', 'decoration', 'beaute', 'sport', 'voyage']

// Même classement que « Les codes les plus copiés » : clics de la semaine, puis au total.
export const parClics = parClassement
