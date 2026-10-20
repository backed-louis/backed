/**
 * Backed – Découvrir des créateurs YouTube qui ont des campagnes avec code promo
 * Usage: AIRTABLE_API_KEY=xxx YOUTUBE_API_KEY=xxx node scripts/discover-creators.js
 *
 * 1. Cherche les vidéos françaises récentes qui parlent de code promo (recherche YouTube).
 * 2. Ajoute les chaînes de scripts/creators/candidats.txt.
 * 3. Pour chaque chaîne absente de Backed : abonnés, et part des 15 dernières vidéos
 *    dont la description contient un code promo (= campagnes récurrentes), avec des exemples.
 * 4. Écrit un classement : out/decouverte/createurs.md (aussi dans le résumé du run) et .csv.
 *
 * Quota YouTube : une recherche coûte 100 unités (quota de 10 000 par jour, partagé avec la synchro).
 * Par défaut ~1 000 unités pour la découverte + 100 par nom de la liste.
 */

const fs = require('fs')
const path = require('path')

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const BASE = process.env.AIRTABLE_BASE_ID || 'appzPhfC7ZdsjlPNa'
const MIN_SUBSCRIBERS = Number(process.env.MIN_SUBSCRIBERS || 40000)
const DAYS = Number(process.env.DAYS || 45)
const WITH_CANDIDATES = process.env.WITH_CANDIDATES !== 'false'
const OUT_DIR = process.env.OUT_DIR || 'out/decouverte'
const RECENT_VIDEOS = 15

// Recherches YouTube (2 pages de 50 vidéos chacune).
const QUERIES = ['code promo', 'avec mon code', 'code promo lien en description', 'partenaire de cette vidéo code']
const PAGES_PER_QUERY = 2

// Un code promo dans une description : « code SQUEEZIE », « code promo : MICHOU10 », « avec le code "X" ».
const CODE_RE = /(?:code(?:\s+(?:promo|créateur|createur))?|avec\s+le\s+code|utilise[rz]?\s+(?:le\s+|mon\s+)?code)\s*[:：«"“'‘-]?\s*[«"“'‘]?([A-Za-z0-9][A-Za-z0-9_-]{2,19})/gi
const NOT_CODES = new Set(['promo', 'pour', 'dans', 'avec', 'sur', 'est', 'qui', 'les', 'des', 'une', 'and', 'the', 'source', 'lien', 'ici', 'suivant', 'personnel', 'exclusif'])

let quotaUsed = 0

async function yt(endpoint, params, cost = 1) {
  const q = new URLSearchParams({ ...params, key: YOUTUBE_API_KEY })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${q}`)
  const data = await res.json()
  quotaUsed += cost
  if (data.error) throw new Error(`YouTube ${data.error.code}: ${data.error.message}`)
  return data
}

function codesIn(text) {
  const found = []
  for (const m of String(text || '').matchAll(CODE_RE)) {
    const code = m[1]
    if (!NOT_CODES.has(code.toLowerCase()) && /[A-Z0-9]/.test(code)) found.push(code)
  }
  return [...new Set(found)]
}

async function existingChannelIds() {
  const ids = new Set()
  let offset
  do {
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/Creators?fields[]=Channel%20ID${offset ? `&offset=${offset}` : ''}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    })
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`)
    const data = await res.json()
    data.records.forEach((r) => r.fields['Channel ID'] && ids.add(r.fields['Channel ID']))
    offset = data.offset
  } while (offset)
  return ids
}

async function channelsInfo(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 50) {
    const data = await yt('channels', { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(',') })
    out.push(...(data.items || []))
  }
  return out
}

// Part des dernières vidéos (hors Shorts courts) avec un code promo, et exemples de codes.
async function recentCampaigns(channel) {
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) return { checked: 0, withCode: 0, codes: [] }
  const list = await yt('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: String(RECENT_VIDEOS) })
  const ids = (list.items || []).map((it) => it.contentDetails.videoId)
  if (!ids.length) return { checked: 0, withCode: 0, codes: [] }
  const vids = await yt('videos', { part: 'snippet', id: ids.join(',') })
  let withCode = 0
  const codes = []
  for (const v of vids.items || []) {
    const c = codesIn(v.snippet?.description)
    if (c.length) {
      withCode++
      codes.push(...c)
    }
  }
  return { checked: (vids.items || []).length, withCode, codes: [...new Set(codes)] }
}

function readCandidates() {
  const file = path.join(__dirname, 'creators', 'candidats.txt')
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
}

async function resolveCandidate(name) {
  if (name.startsWith('@')) {
    const data = await yt('channels', { part: 'id', forHandle: name })
    return data.items?.[0]?.id || null
  }
  const data = await yt('search', { part: 'snippet', type: 'channel', maxResults: '1', regionCode: 'FR', relevanceLanguage: 'fr', q: name }, 100)
  return data.items?.[0]?.snippet?.channelId || null
}

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const csvCell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`

async function main() {
  if (!AIRTABLE_API_KEY || !YOUTUBE_API_KEY) {
    console.error('❌ AIRTABLE_API_KEY et YOUTUBE_API_KEY requis')
    process.exit(1)
  }
  const known = await existingChannelIds()
  console.log(`🗂️  ${known.size} chaînes déjà sur Backed`)

  // channelId -> { via: Set, hits: nombre de vidéos trouvées par la recherche }
  const pool = new Map()
  const add = (id, via) => {
    if (!id || known.has(id)) return
    const p = pool.get(id) || { via: new Set(), hits: 0 }
    p.via.add(via)
    if (via === 'recherche') p.hits++
    pool.set(id, p)
  }

  const after = new Date(Date.now() - DAYS * 864e5).toISOString()
  try {
    for (const q of QUERIES) {
      let pageToken = ''
      for (let page = 0; page < PAGES_PER_QUERY; page++) {
        const data = await yt('search', {
          part: 'snippet', type: 'video', maxResults: '50', regionCode: 'FR', relevanceLanguage: 'fr',
          publishedAfter: after, order: 'viewCount', q, ...(pageToken ? { pageToken } : {}),
        }, 100)
        for (const it of data.items || []) add(it.snippet.channelId, 'recherche')
        pageToken = data.nextPageToken
        if (!pageToken) break
      }
      console.log(`🔎 « ${q} » : ${pool.size} chaînes candidates`)
    }
  } catch (err) {
    console.error(`⚠️  Recherche interrompue : ${err.message}`)
  }

  const unresolved = []
  if (WITH_CANDIDATES) {
    for (const name of readCandidates()) {
      try {
        const id = await resolveCandidate(name)
        if (!id) unresolved.push(name)
        else if (known.has(id)) console.log(`⏭️  ${name} : déjà sur Backed`)
        else add(id, `liste (${name})`)
      } catch (err) {
        unresolved.push(`${name} (${err.message})`)
      }
    }
  }

  const channels = await channelsInfo([...pool.keys()])
  const rows = []
  for (const ch of channels) {
    const subs = Number(ch.statistics?.subscriberCount || 0)
    const fromList = [...pool.get(ch.id).via].some((v) => v.startsWith('liste'))
    if (subs < MIN_SUBSCRIBERS && !fromList) continue
    let camp = { checked: 0, withCode: 0, codes: [] }
    try {
      camp = await recentCampaigns(ch)
    } catch (err) {
      console.error(`⚠️  ${ch.snippet.title} : ${err.message}`)
    }
    const share = camp.checked ? camp.withCode / camp.checked : 0
    rows.push({
      title: ch.snippet.title,
      id: ch.id,
      handle: ch.snippet.customUrl || '',
      country: ch.snippet.country || '',
      subs,
      withCode: camp.withCode,
      checked: camp.checked,
      share,
      codes: camp.codes.slice(0, 4),
      via: [...pool.get(ch.id).via].join(', '),
      // Score : campagnes récurrentes d'abord, pondérées par l'audience.
      score: share * Math.log10(Math.max(subs, 10)),
    })
  }
  rows.sort((a, b) => b.score - a.score || b.subs - a.subs)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const md = [
    `# Créateurs à découvrir`,
    ``,
    `Chaînes absentes de Backed, classées par campagnes récurrentes (vidéos avec code promo parmi les ${RECENT_VIDEOS} dernières) puis par audience. Recherche sur les ${DAYS} derniers jours, seuil ${fmt(MIN_SUBSCRIBERS)} abonnés (sauf pour la liste). Quota YouTube utilisé : ${fmt(quotaUsed)} unités.`,
    ``,
    `| # | Chaîne | Abonnés | Vidéos avec code | Exemples de codes | Pays | Trouvée via |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
    ...rows.map((r, i) => `| ${i + 1} | [${r.title}](https://www.youtube.com/channel/${r.id})${r.handle ? ` ${r.handle}` : ''} | ${fmt(r.subs)} | ${r.withCode}/${r.checked} | ${r.codes.join(', ') || '—'} | ${r.country || '—'} | ${r.via} |`),
    ``,
    unresolved.length ? `Introuvables dans la liste : ${unresolved.join(', ')}` : '',
  ].join('\n')
  fs.writeFileSync(path.join(OUT_DIR, 'createurs.md'), md)
  fs.writeFileSync(
    path.join(OUT_DIR, 'createurs.csv'),
    ['rang,chaine,handle,channel_id,abonnes,videos_avec_code,videos_verifiees,exemples_codes,pays,trouvee_via',
      ...rows.map((r, i) => [i + 1, r.title, r.handle, r.id, r.subs, r.withCode, r.checked, r.codes.join(' '), r.country, r.via].map(csvCell).join(','))].join('\n'),
  )
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n')
  console.log(md)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
