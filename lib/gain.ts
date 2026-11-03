// Avantage d'une offre découpé pour l'affichage premium (même logique que les vidéos, scripts/motion/code_du_jour.html) :
// « 15% de réduction sur la livraison » → { value: "−15", unit: "%", rest: "sur la livraison" }
// « -10€ dès 30€ d'achat »             → { value: "−10", unit: "€", rest: "dès 30€ d'achat" }
// « 1 mois de training offert »         → { value: "", unit: "", rest: "1 mois de training offert" }
export interface GainParts {
  value: string
  unit: string
  rest: string
}

const LEAD = /^([-−]?\s?\d+(?:[.,]\d+)?)\s?(%|€)\s*(.*)$/i

export function gainParts(benefit: string): GainParts {
  const src = (benefit || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  const m = src.match(LEAD)
  if (!m) return { value: '', unit: '', rest: src }
  let value = m[1].replace(/\s+/g, '').replace(/^-/, '−')
  const unit = m[2]
  // « 15% » sans signe est une réduction ; « 20 € offerts » reste tel quel
  if (unit === '%' && !value.startsWith('−')) value = '−' + value
  const rest = m[3].replace(/^(de\s+)?(réduction|remise|réduc)\s*/i, '').replace(/[ .]+$/, '')
  return { value, unit, rest }
}
