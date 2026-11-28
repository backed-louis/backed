/**
 * Backed – Relevé quotidien (table Airtable « Suivi quotidien »)
 * Usage: AIRTABLE_API_KEY=xxx node scripts/daily-stats.js
 *
 * Écrit (ou remplace) la ligne du jour, date de Paris :
 * - les compteurs du site, calculés avec les mêmes règles que lib/airtable.ts
 *   (offre Active et non expirée, marque avec slug, sans doublons) ;
 * - les clics et les copies cumulés de chaque offre, pour les calculer jour par jour ;
 * - les clics cumulés de chaque lien suivi (backed.fr/l/…).
 */

const { isDisplayable } = require('./lib/offres')

const API_KEY = process.env.AIRTABLE_API_KEY
const BASE = process.env.AIRTABLE_BASE_ID || 'appzPhfC7ZdsjlPNa'
const STATS_TABLE = 'Suivi quotidien'

const ACTIVE_NOT_EXPIRED =
  'AND({Status}="Active", OR({End Date}="", IS_AFTER({End Date}, DATEADD(TODAY(), -1, \'days\'))))'

async function fetchAll(table, params = {}) {
  const records = []
  let offset
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`)
    for (const [k, v] of Object.entries(params)) {
      for (const one of [].concat(v)) url.searchParams.append(k, one)
    }
    if (offset) url.searchParams.set('offset', offset)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } })
    if (!res.ok) throw new Error(`Airtable [${table}] ${res.status}: ${await res.text()}`)
    const data = await res.json()
    records.push(...(data.records || []))
    offset = data.offset
  } while (offset)
  return records
}

// Même garde-fou anti-doublons que le site : une offre par (créateur, marque, code ou lien), la plus récente.
function dedupe(records) {
  const keyOf = (r) => {
    const creator = r.fields['Creator']?.[0] || ''
    const brand = r.fields['Brand']?.[0] || ''
    const code = String(r.fields['Code'] || '').trim().toLowerCase()
    const url = String(r.fields['Source URL'] || '').split('?')[0].toLowerCase().replace(/\/$/, '')
    return `${creator}|${brand}|${code || url || r.id}`
  }
  const newest = new Map()
  for (const r of records) {
    const k = keyOf(r)
    const cur = newest.get(k)
    if (!cur || String(r.createdTime) > String(cur.createdTime)) newest.set(k, r)
  }
  return Array.from(newest.values())
}

async function main() {
  if (!API_KEY) {
    console.error('❌ AIRTABLE_API_KEY requis')
    process.exit(1)
  }
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }) // AAAA-MM-JJ

  const [brands, creators, active, clicked] = await Promise.all([
    fetchAll('Brands', { 'fields[]': ['Name', 'slug'] }),
    fetchAll('Creators', { 'fields[]': ['Name'] }),
    fetchAll('Offers', {
      filterByFormula: ACTIVE_NOT_EXPIRED,
      'fields[]': ['Code', 'Brand', 'Creator', 'Source URL', 'Benefit'],
    }),
    fetchAll('Offers', { filterByFormula: '{Clicks}>0', 'fields[]': ['Clicks', 'Copies'] }),
  ])
  // Liens suivis (backed.fr/l/…) : table créée le 28/11/2026, absente des anciennes bases.
  const links = await fetchAll('Liens suivis', { 'fields[]': ['Source', 'Clics'] }).catch(() => [])

  const brandOk = new Map(brands.map((b) => [b.id, Boolean(b.fields['Name'] && b.fields['slug'])]))
  const creatorName = new Map(creators.map((c) => [c.id, c.fields['Name'] || '']))
  // Comme le site : marque valide, et un code promo ou un lien perso du créateur avec un avantage chiffré.
  const offers = dedupe(active).filter((r) => brandOk.get(r.fields['Brand']?.[0]) &&
    isDisplayable({ code: r.fields['Code'], sourceUrl: r.fields['Source URL'], benefit: r.fields['Benefit'] }))

  const activeCreators = new Set(offers.map((r) => creatorName.get(r.fields['Creator']?.[0])).filter(Boolean))
  const clicks = {}
  const copies = {}
  let totalClicks = 0
  for (const r of clicked) {
    clicks[r.id] = r.fields['Clicks']
    totalClicks += r.fields['Clicks']
    if (r.fields['Copies']) copies[r.id] = r.fields['Copies']
  }
  const linkClicks = {}
  for (const r of links) {
    const s = r.fields['Source']
    if (s) linkClicks[s] = (linkClicks[s] || 0) + (r.fields['Clics'] || 0) // deux lignes possibles si deux premiers clics simultanés
  }

  const fields = {
    Date: day,
    'Offres actives': offers.length,
    'Avec code': offers.filter((r) => String(r.fields['Code'] || '').trim()).length,
    'Marques actives': new Set(offers.map((r) => r.fields['Brand'][0])).size,
    'Créateurs actifs': activeCreators.size,
    'Créateurs soutenus': creators.length,
    'Clics cumulés': totalClicks,
    'Clics par offre': JSON.stringify(clicks),
    'Copies par offre': JSON.stringify(copies),
    'Liens suivis': JSON.stringify(linkClicks),
  }

  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(STATS_TABLE)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ['Date'] }, records: [{ fields }], typecast: true }),
  })
  if (!res.ok) throw new Error(`Airtable [${STATS_TABLE}] ${res.status}: ${await res.text()}`)

  const { ['Clics par offre']: _, ['Copies par offre']: __, ...summary } = fields
  console.log('✅ Relevé écrit :', summary)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
