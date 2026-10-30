/**
 * Backed – Compléter les fiches marques
 * Usage: AIRTABLE_API_KEY=xxx ANTHROPIC_API_KEY=xxx node scripts/complete-brands.js
 *
 * Pour chaque marque dont la fiche est incomplète (description, catégorie ou site web
 * manquant ou inutilisable), demande à Claude une description, le site officiel et la
 * catégorie, puis remplit seulement les champs vides. Un site web n'est enregistré que
 * s'il répond. Le site n'affiche une marque que si sa fiche a une description et une
 * catégorie (voir hasValidBrand dans lib/airtable.ts).
 */

const API_KEY = process.env.AIRTABLE_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const BASE = process.env.AIRTABLE_BASE_ID || 'appzPhfC7ZdsjlPNa'
const MAX_PER_RUN = 40

// Sites qui ne sont jamais celui d'une marque (réseaux sociaux, moteurs, raccourcisseurs…).
const BAD_HOSTS = [
  'google.com', 'instagram.com', 'facebook.com', 'tiktok.com', 'x.com', 'twitter.com',
  'youtube.com', 'youtu.be', 'linktr.ee', 'urls.fr', 'bit.ly', 'amzn.to', 'tinyurl.com',
  'short.gy', 'cutt.ly', 'shorturl.at', 'taap.it', 'urlr.me', 'lnk.to', 'geni.us', 'rebrand.ly',
  'tidd.ly', 'ow.ly', 'hfly.co', 'onelink.me', 'go.link',
]

const airtable = (path, init = {}) =>
  fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`)
    return res.json()
  })

async function fetchAll(table, fields) {
  const records = []
  let offset
  do {
    const q = new URLSearchParams()
    fields.forEach((f) => q.append('fields[]', f))
    if (offset) q.set('offset', offset)
    const data = await airtable(`${encodeURIComponent(table)}?${q}`)
    records.push(...data.records)
    offset = data.offset
  } while (offset)
  return records
}

// Renvoie une URL https propre, ou null si elle est vide, invalide ou n'est pas un site de marque.
function cleanWebsite(value) {
  let v = String(value || '').trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  try {
    const u = new URL(v)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (BAD_HOSTS.some((h) => host === h || host.endsWith('.' + h)) && host !== 'gemini.google.com') return null
    return v
  } catch {
    return null
  }
}

async function websiteAnswers(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 (Backed brand check)' } })
    // 403/405/429 : le site existe mais bloque les robots.
    return res.ok || [401, 403, 405, 429].includes(res.status)
  } catch {
    return false
  }
}

async function askClaude(name, categories, hint, offer) {
  const prompt = [
    `Tu complètes la fiche d'une marque pour Backed, un site français qui recense les codes promo partagés par les créateurs YouTube.`,
    `Marque : "${name}"${hint ? ` (lien vu dans une vidéo : ${hint})` : ''}`,
    offer ? `Offre partagée par un créateur pour cette marque : « ${offer} ». Sers-t'en pour reconnaître la marque.` : '',
    ``,
    `Réponds UNIQUEMENT en JSON :`,
    `{"description": "...", "website": "https://..." ou null, "category": "..." ou null}`,
    ``,
    `- description : une phrase en français, 90 caractères maximum, qui dit ce que vend ou propose la marque. Ton neutre, sans superlatif ni slogan, sans point final inutile.`,
    `- website : la page d'accueil officielle de la marque (de préférence en France). null si tu n'es pas certain de l'adresse. Jamais un réseau social, un lien raccourci ou une page Google.`,
    `- category : exactement une de ces catégories : ${categories.join(', ')}. null si aucune ne convient.`,
    `- Si tu ne connais pas cette marque, renvoie {"description": null, "website": null, "category": null}. N'invente rien.`,
  ].join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = (data.content?.[0]?.text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

async function main() {
  if (!API_KEY || !ANTHROPIC_API_KEY) {
    console.error('❌ AIRTABLE_API_KEY et ANTHROPIC_API_KEY requis')
    process.exit(1)
  }

  const categories = await fetchAll('Categories', ['Name'])
  const categoryId = new Map(categories.map((c) => [String(c.fields['Name'] || '').toLowerCase(), c.id]))
  const categoryNames = categories.map((c) => c.fields['Name']).filter(Boolean)
  const brands = await fetchAll('Brands', ['Name', 'Description', 'Website', 'Category'])
  // Une offre de chaque marque aide Claude à la reconnaître (ex. « 20 % sur l'offre carrosserie » pour Delko).
  const offerOf = new Map()
  for (const r of await fetchAll('Offers', ['Brand', 'Benefit'])) {
    const b = r.fields['Brand']?.[0]
    if (b && r.fields['Benefit'] && !offerOf.has(b)) offerOf.set(b, String(r.fields['Benefit']).slice(0, 160))
  }

  const todo = brands.filter((b) => {
    const f = b.fields
    return f['Name'] && (!String(f['Description'] || '').trim() || !f['Category']?.length || cleanWebsite(f['Website']) !== f['Website'])
  })
  console.log(`🏷️  ${todo.length} fiche(s) marque à compléter`)

  let done = 0
  for (const b of todo.slice(0, MAX_PER_RUN)) {
    const f = b.fields
    const fields = {}
    const current = cleanWebsite(f['Website'])
    if (current && current !== f['Website']) fields['Website'] = current // ex. "hellofresh.fr" -> "https://hellofresh.fr"

    const needsDescription = !String(f['Description'] || '').trim()
    const needsCategory = !f['Category']?.length
    const needsWebsite = !current

    if (needsDescription || needsCategory || needsWebsite) {
      try {
        const answer = await askClaude(f['Name'], categoryNames, cleanWebsite(f['Website']) || null, offerOf.get(b.id))
        if (needsDescription && typeof answer.description === 'string' && answer.description.trim()) {
          fields['Description'] = answer.description.trim().slice(0, 140)
        }
        const cat = typeof answer.category === 'string' && categoryId.get(answer.category.toLowerCase())
        if (needsCategory && cat) fields['Category'] = [cat]
        const site = needsWebsite && cleanWebsite(answer.website)
        if (site && (await websiteAnswers(site))) fields['Website'] = site
      } catch (err) {
        console.error(`  ❌ ${f['Name']} : ${err.message}`)
        continue
      }
    }

    if (Object.keys(fields).length) {
      await airtable('Brands', { method: 'PATCH', body: JSON.stringify({ records: [{ id: b.id, fields }] }) })
      done++
      console.log(`  ✅ ${f['Name']} : ${Object.keys(fields).join(', ')}`)
    } else {
      console.log(`  ⚠️  ${f['Name']} : rien de fiable trouvé, à compléter à la main`)
    }
  }
  console.log(`✅ ${done} fiche(s) marque mise(s) à jour`)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
