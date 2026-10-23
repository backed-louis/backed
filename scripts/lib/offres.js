// Règles d'affichage des offres, partagées par les scripts (mêmes règles que lib/airtable.ts côté site).

// Avantage concret et chiffré : « 20 € offerts », « -15 % », « 4 mois offerts », « 7 jours gratuits »…
const ADVANTAGE = /\d+([.,]\d+)?\s?(%|€|euros?\b|mois\b|jours?\b|ans?\b|go\b)|offert|gratuit|essai/i

// Offre « lien » : pas de code, mais un lien personnel du créateur (ex. get.revolut.com/…/SQueezie)
// avec un avantage chiffré. Les liens sans avantage, ou qui renvoient juste à la vidéo, restent masqués.
function isLinkOffer({ code, sourceUrl, benefit }) {
  if (String(code || '').trim()) return false
  let host = ''
  try {
    host = new URL(String(sourceUrl || '')).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return false
  }
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return false
  const b = String(benefit || '')
  return ADVANTAGE.test(b) && !/newsletter/i.test(b)
}

// Une offre est affichée si elle a un code, ou si c'est une offre lien.
function isDisplayable(offer) {
  return Boolean(String(offer.code || '').trim()) || isLinkOffer(offer)
}

// ─── Date de fin écrite dans la description d'une vidéo ──────────────────────

const MONTHS = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
}
const KW = "(?:jusqu'?au|jusqu'?à|jusqu'?a|se termine le|termine le|prend fin le|fin le|expire le|valable jusqu'?(?:au|à|a)|avant le|until)"
// 30/09, 30/09/2026, 30.09.2026, 30-09-2026 (point ou tiret seulement avec l'année, pour ne pas lire « 1.5 Go »)
const NUM = '(?:(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?|(\\d{1,2})[.-](\\d{1,2})[.-](\\d{2,4}))(?![\\d,.]*\\s?(?:%|€|go\\b))'
const TXT = `(\\d{1,2})(?:er)?\\s+(${Object.keys(MONTHS).join('|')})(?:\\s+(\\d{4}))?`
const RE_NUM = new RegExp(`${KW}\\s*(?:le\\s+|au\\s+)?(?:\\w+\\s+)?${NUM}`, 'i')
const RE_TXT = new RegExp(`${KW}\\s*(?:le\\s+|au\\s+)?(?:\\w+\\s+)?${TXT}`, 'i')
const RE_END_OF_YEAR = new RegExp(`${KW}\\s*(?:la\\s+)?fin\\s+(\\d{4})`, 'i')

function iso(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

// Année manquante : celle de la publication, ou la suivante si la date tomberait avant la vidéo.
function withYear(d, m, y, publishedDate) {
  if (y) {
    y = Number(y)
    if (y < 100) y += 2000
    return iso(y, m, d)
  }
  const pub = publishedDate ? new Date(`${publishedDate}T00:00:00Z`) : new Date()
  let out = iso(pub.getUTCFullYear(), m, d)
  if (out && new Date(`${out}T00:00:00Z`) < new Date(pub.getTime() - 7 * 86400000)) out = iso(pub.getUTCFullYear() + 1, m, d)
  return out
}

function findDate(text, publishedDate) {
  let m = text.match(RE_NUM)
  if (m) {
    const out = m[1] ? withYear(Number(m[1]), Number(m[2]), m[3], publishedDate) : withYear(Number(m[4]), Number(m[5]), m[6], publishedDate)
    if (out) return out
  }
  m = text.match(RE_TXT)
  if (m) {
    const out = withYear(Number(m[1]), MONTHS[m[2].toLowerCase()], m[3], publishedDate)
    if (out) return out
  }
  m = text.match(RE_END_OF_YEAR)
  if (m) return iso(Number(m[1]), 12, 31)
  return null
}

// Cherche une date de fin près de l'offre (son code ou son lien) dans la description :
// dans le paragraphe de l'offre et les lignes qui suivent, sans déborder sur l'offre suivante.
function endDateFromText(description, anchors, publishedDate) {
  const text = String(description || '').replace(/[’‘`]/g, "'")
  const lower = text.toLowerCase()
  for (const a of anchors) {
    const anchor = String(a || '').trim().toLowerCase()
    if (anchor.length < 3) continue
    const pos = lower.indexOf(anchor)
    if (pos < 0) continue
    // Après l'offre : jusqu'au prochain lien (une autre offre), 500 caractères au plus.
    const after = text.slice(pos + anchor.length, pos + anchor.length + 500)
    const next = after.search(/https?:\/\//i)
    const tail = next >= 0 ? after.slice(0, next) : after
    // Avant l'offre : la ligne où elle se trouve.
    const lineStart = text.lastIndexOf('\n', pos) + 1
    const head = text.slice(Math.max(lineStart, pos - 200), pos)
    const found = findDate(head + ' ' + tail, publishedDate)
    if (found) return found
  }
  return null
}

// ─── Offre Black Friday ───────────────────────────────────────────────────────

const BLACK_FRIDAY = /black\s*friday|black\s*friyay|black\s*week|black\s*november|cyber\s*monday/i

// L'offre est-elle présentée comme une offre Black Friday ? On regarde son propre bloc dans la
// description (sa ligne et ce qui suit jusqu'au lien suivant), pas toute la description.
function blackFridayFromText(description, anchors) {
  const text = String(description || '')
  const lower = text.toLowerCase()
  for (const a of anchors) {
    const anchor = String(a || '').trim().toLowerCase()
    if (anchor.length < 3) continue
    const pos = lower.indexOf(anchor)
    if (pos < 0) continue
    const after = text.slice(pos + anchor.length, pos + anchor.length + 300)
    const next = after.search(/https?:\/\//i)
    const lineStart = text.lastIndexOf('\n', pos) + 1
    const head = text.slice(Math.max(lineStart, pos - 200), pos)
    if (BLACK_FRIDAY.test(head + ' ' + (next >= 0 ? after.slice(0, next) : after))) return true
  }
  return false
}

module.exports = { ADVANTAGE, isLinkOffer, isDisplayable, endDateFromText, BLACK_FRIDAY, blackFridayFromText }
