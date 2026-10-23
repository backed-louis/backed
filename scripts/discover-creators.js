/**
 * Backed – Découvrir des créateurs YouTube : communauté active + sponsos réguliers
 * Usage: AIRTABLE_API_KEY=xxx YOUTUBE_API_KEY=xxx node scripts/discover-creators.js
 *
 * 1. Cherche les vidéos françaises récentes sponsorisées (codes promo, « sponsorisé par »,
 *    marques qui sponsorisent beaucoup de youtubeurs : NordVPN, Raid Shadow Legends…).
 * 2. Ajoute les chaînes de scripts/creators/candidats.txt et retire celles de exclus.txt.
 * 3. Pour chaque chaîne absente de Backed, sur ses dernières vidéos longues (hors Shorts) :
 *    - communauté active : vues médianes / abonnés ;
 *    - sponsos réguliers : part des vidéos avec un code promo, un partenariat annoncé
 *      ou la mention « communication commerciale » de YouTube ;
 *    - activité : nombre de vidéos longues sur 90 jours.
 * 4. Écrit un classement : out/decouverte/createurs.md (aussi dans le résumé du run) et .csv.
 *
 * Inspection (CHANNELS="@pseudo, UC…") : seulement ces chaînes, avec leurs dernières vidéos et
 * les lignes sponsor de chaque description -> out/decouverte/inspection.md.
 *
 * Quota YouTube (10 000 unités par jour, partagé avec la synchro) : une recherche coûte 100,
 * le reste 1. Par défaut ~1 200 unités de recherche + 2 par chaîne étudiée ; un nom de la liste
 * sans @ coûte 1 unité s'il correspond à un @pseudo, sinon 100. Plafond : MAX_QUOTA (7 500).
 */

const fs = require('fs')
const path = require('path')

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const BASE = process.env.AIRTABLE_BASE_ID || 'appzPhfC7ZdsjlPNa'
const MIN_SUBSCRIBERS = Number(process.env.MIN_SUBSCRIBERS || 40000)
const DAYS = Number(process.env.DAYS || 45)
const WITH_CANDIDATES = process.env.WITH_CANDIDATES !== 'false'
const MAX_QUOTA = Number(process.env.MAX_QUOTA || 7500)
const OUT_DIR = process.env.OUT_DIR || 'out/decouverte'
// Pays acceptés (code ISO déclaré par la chaîne). Une chaîne sans pays déclaré est gardée
// seulement si ses textes sont en français.
const COUNTRIES = (process.env.COUNTRIES || 'FR').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)

const LONG_VIDEOS = 15 // vidéos longues étudiées par chaîne
const SHORT_MAX_SECONDS = 180 // en dessous : Short, ignoré
const FRESH_DAYS = 5 // une vidéo plus récente n'a pas encore fait ses vues
const MIN_UPLOADS_90 = 2 // vidéos longues sur 90 jours pour être considérée active
const MIN_SPONSORED = 2 // vidéos sponsorisées pour être retenue (hors liste)
const REF_RATIO = 0.1 // vues médianes = 10 % des abonnés : communauté « normale »
const STUDY_RESERVE = 1000 // unités gardées pour étudier les chaînes trouvées
const canSearch = () => quotaUsed + 100 <= MAX_QUOTA - STUDY_RESERVE
// Les noms de la liste ne peuvent pas manger le quota des recherches de découverte.
const canSearchName = () => quotaUsed + 100 <= MAX_QUOTA - STUDY_RESERVE - QUERIES.length * 100

// Recherches YouTube (1 page de 50 vidéos chacune, triées par vues ; medium = 4 à 20 min,
// long = plus de 20 min, pour ne pas remonter des Shorts).
const QUERIES = [
  ['code promo', 'medium'], ['code promo', 'long'], ['avec mon code', 'medium'],
  ['sponsorisé par', 'medium'], ['sponsorisé par', 'long'], ['partenaire de cette vidéo', 'medium'],
  ...['NordVPN', 'Surfshark', 'Raid Shadow Legends', 'Dashlane', 'Saily', 'HelloFresh', 'Revolut', 'Holy'].map((q) => [q, 'medium']),
]

// Un code promo dans une description : « code SQUEEZIE », « code promo : MICHOU10 », « avec le code "X" ».
const CODE_RE = /(?:code(?:\s+(?:promo|créateur|createur))?|avec\s+le\s+code|utilise[rz]?\s+(?:le\s+|mon\s+)?code)\s*[:：«"“'‘-]?\s*[«"“'‘]?([A-Za-z0-9][A-Za-z0-9_-]{2,19})/gi
const NOT_CODES = new Set(['promo', 'pour', 'dans', 'avec', 'sur', 'est', 'qui', 'les', 'des', 'une', 'and', 'the', 'source', 'lien', 'ici', 'suivant', 'personnel', 'exclusif', 'de', 'la', 'route'])
// Partenariat annoncé sans code (lien personnel, sponsor cité).
const SPONSOR_RE = /sponsoris[ée]|partenaire de (cette|la) vid[ée]o|en partenariat avec|collaboration commerciale|communication commerciale|placement de produit|lien affili|avec mon lien|via mon lien|gr[âa]ce [àa] mon lien/i

// Liens qui ne sont pas des marques (réseaux, dons, musique…) et raccourcisseurs (marque inconnue).
const NOT_BRAND_HOST = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|fb\.me|twitch\.tv|discord\.gg|discord\.com|linktr\.ee|patreon\.com|tipeee\.com|utip\.io|spotify\.com|apple\.com|deezer\.com|threads\.net|snapchat\.com|linkedin\.com|bsky\.app|google\.com|goo\.gl|wikipedia\.org|kick\.com|whatsapp\.com|t\.me|reddit\.com|pinterest\.\w+|soundcloud\.com|bandcamp\.com|ko-fi\.com|beacons\.ai)$/i
const SHORTENER = /(^|\.)(bit\.ly|tinyurl\.com|lnk\.to|urlz\.fr|cutt\.ly|rebrand\.ly|shorturl\.at|geni\.us|amzn\.to|ow\.ly|tidd\.ly|go2\.\w+|s\.\w+\.\w+)$/i
function hostsIn(text) {
  const hosts = new Set()
  for (const m of String(text || '').matchAll(/https?:\/\/([^/\s?#)]+)/gi)) {
    const h = m[1].toLowerCase().replace(/^www\./, '')
    if (!NOT_BRAND_HOST.test(h)) hosts.add(h)
  }
  return hosts
}

// Lignes d'une description qui parlent du sponsor (code, partenariat), pour l'inspection.
function sponsorLines(desc) {
  return String(desc || '').split('\n').map((l) => l.trim())
    .filter((l) => l && (new RegExp(CODE_RE.source, 'i').test(l) || SPONSOR_RE.test(l)))
    .slice(0, 3).map((l) => (l.length > 180 ? `${l.slice(0, 177)}…` : l))
}

// Texte plutôt français que anglais (mots outils les plus fréquents).
const FR_WORDS = /\b(le|la|les|des|du|et|pour|avec|sur|dans|une|est|vous|ton|ta|tes|mon|ma|mes|abonne|vidéo)\b/gi
const EN_WORDS = /\b(the|and|with|for|your|you|this|subscribe|video|check|out)\b/gi
function looksFrench(text) {
  const t = String(text || '')
  const fr = (t.match(FR_WORDS) || []).length
  const en = (t.match(EN_WORDS) || []).length
  return fr >= 5 && fr > en * 1.5
}

let quotaUsed = 0
let quotaExhausted = false

async function yt(endpoint, params, cost = 1) {
  if (quotaExhausted) throw new Error('quota YouTube épuisé')
  if (quotaUsed + cost > MAX_QUOTA) throw new Error(`plafond de ${MAX_QUOTA} unités atteint`)
  const q = new URLSearchParams({ ...params, key: YOUTUBE_API_KEY })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${q}`)
  const data = await res.json()
  quotaUsed += cost
  if (data.error) {
    if (data.error.errors?.some((e) => e.reason === 'quotaExceeded')) quotaExhausted = true
    throw new Error(`YouTube ${data.error.code}: ${data.error.message}`)
  }
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

// « PT1H2M3S » -> secondes
function seconds(iso) {
  const m = String(iso || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0)
}

function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return 0
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

const normalize = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

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

// La mention YouTube « Inclut une communication commerciale » n'est pas toujours exposée :
// si la partie est refusée, on continue sans.
let withPlacement = true
async function videosDetails(ids) {
  const parts = 'snippet,statistics,contentDetails'
  if (withPlacement) {
    try {
      return await yt('videos', { part: `${parts},paidProductPlacementDetails`, id: ids.join(',') })
    } catch (err) {
      if (quotaExhausted || /plafond/.test(err.message)) throw err
      withPlacement = false
    }
  }
  return yt('videos', { part: parts, id: ids.join(',') })
}

// Vidéos longues récentes : vues, sponsos, régularité.
async function study(channel) {
  const empty = { long: 0, sponsored: 0, codes: [], brands: [], permanent: [], videos: [], medianViews: 0, engagement: 0, uploads90: 0, lastLong: null, french: false }
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) return empty
  const list = await yt('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '50' })
  const ids = (list.items || []).map((it) => it.contentDetails.videoId)
  if (!ids.length) return empty
  const data = await videosDetails(ids)
  const now = Date.now()
  const texts = []
  const long = []
  for (const v of data.items || []) {
    texts.push(v.snippet?.title || '', v.snippet?.description || '')
    if (seconds(v.contentDetails?.duration) <= SHORT_MAX_SECONDS) continue
    if (v.snippet?.liveBroadcastContent && v.snippet.liveBroadcastContent !== 'none') continue
    long.push(v)
  }
  long.sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt))
  const recent = long.slice(0, LONG_VIDEOS)
  let sponsored = 0
  const codes = []
  const hostCount = new Map()
  const sponsoredHosts = new Set()
  const videos = []
  for (const v of recent) {
    const desc = v.snippet?.description || ''
    const c = codesIn(desc)
    const placement = Boolean(v.paidProductPlacementDetails?.hasPaidProductPlacement)
    const isSponsored = placement || c.length > 0 || SPONSOR_RE.test(desc)
    if (isSponsored) sponsored++
    codes.push(...c)
    const hosts = hostsIn(desc)
    hosts.forEach((h) => hostCount.set(h, (hostCount.get(h) || 0) + 1))
    if (isSponsored) hosts.forEach((h) => sponsoredHosts.add(h))
    videos.push({
      date: v.snippet.publishedAt.slice(0, 10),
      views: Number(v.statistics?.viewCount || 0),
      title: v.snippet.title,
      sponsored: isSponsored,
      placement,
      lines: sponsorLines(desc),
    })
  }
  // Un lien présent dans plus de 60 % des vidéos est un lien permanent (boutique, site du créateur) :
  // les marques sont les autres liens des vidéos sponsorisées, hors raccourcisseurs.
  const permanent = [...hostCount].filter(([, n]) => recent.length >= 4 && n / recent.length > 0.6).map(([h]) => h)
  const brands = [...sponsoredHosts].filter((h) => !permanent.includes(h) && !SHORTENER.test(h))
  const aged = recent.filter((v) => now - new Date(v.snippet.publishedAt) > FRESH_DAYS * 864e5)
  const base = aged.length ? aged : recent
  const views = base.map((v) => Number(v.statistics?.viewCount || 0))
  const engagement = base
    .filter((v) => Number(v.statistics?.viewCount) > 0)
    .map((v) => (Number(v.statistics?.likeCount || 0) + Number(v.statistics?.commentCount || 0)) / Number(v.statistics.viewCount))
  return {
    long: recent.length,
    sponsored,
    codes: [...new Set(codes)],
    brands,
    permanent,
    videos,
    medianViews: median(views),
    engagement: median(engagement),
    uploads90: long.filter((v) => now - new Date(v.snippet.publishedAt) <= 90 * 864e5).length,
    lastLong: recent[0]?.snippet?.publishedAt?.slice(0, 10) || null,
    french: looksFrench(texts.join(' ')),
  }
}

function readList(file) {
  const p = path.join(__dirname, 'creators', file)
  if (!fs.existsSync(p)) return []
  return fs.readFileSync(p, 'utf8').split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean)
}

// @pseudo -> 1 unité. Identifiant UC… -> direct. Nom -> on essaie d'abord le @pseudo évident
// (« Andy Raconte » -> @andyraconte, 1 unité), puis la recherche de chaîne (100 unités).
async function resolveCandidate(name) {
  if (/^UC[\w-]{22}$/.test(name)) return name
  if (name.startsWith('@')) {
    const data = await yt('channels', { part: 'id', forHandle: name })
    return data.items?.[0]?.id || null
  }
  const target = normalize(name)
  if (target.length >= 4) {
    const data = await yt('channels', { part: 'snippet', forHandle: `@${target}` })
    const ch = data.items?.[0]
    if (ch && normalize(ch.snippet.title).includes(target)) return ch.id
  }
  if (!canSearchName()) throw new Error('pas assez de quota pour une recherche')
  const data = await yt('search', { part: 'snippet', type: 'channel', maxResults: '1', regionCode: 'FR', relevanceLanguage: 'fr', q: name }, 100)
  return data.items?.[0]?.snippet?.channelId || null
}

function isExcluded(ch, excluded) {
  const handle = normalize(ch.snippet.customUrl)
  const title = normalize(ch.snippet.title)
  return excluded.some((e) => e === ch.id || (normalize(e) && (normalize(e) === handle || normalize(e) === title)))
}

// « liste (X) » tel quel ; les recherches regroupées : « recherche : code promo, NordVPN… ».
function viaLabel(via) {
  const list = [...via].filter((v) => v.startsWith('liste'))
  const searches = [...via].filter((v) => v.startsWith('recherche')).map((v) => v.replace(/^recherche « (.*) »$/, '$1'))
  if (searches.length) list.push(`recherche : ${searches.slice(0, 3).join(', ')}${searches.length > 3 ? '…' : ''}`)
  return list.join(', ')
}

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const pct = (x) => `${Math.round(x * 100)} %`
const csvCell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`

async function main() {
  if (!AIRTABLE_API_KEY || !YOUTUBE_API_KEY) {
    console.error('❌ AIRTABLE_API_KEY et YOUTUBE_API_KEY requis')
    process.exit(1)
  }
  if (process.env.CHANNELS) return inspect(process.env.CHANNELS.split(/[,\n]/).map((c) => c.trim()).filter(Boolean))
  const known = await existingChannelIds()
  const excluded = readList('exclus.txt')
  console.log(`🗂️  ${known.size} chaînes déjà sur Backed, ${excluded.length} exclues`)

  // channelId -> { via: Set }
  const pool = new Map()
  const add = (id, via) => {
    if (!id || known.has(id) || excluded.includes(id)) return
    const p = pool.get(id) || { via: new Set() }
    p.via.add(via)
    pool.set(id, p)
  }

  // La liste d'abord : elle est choisie à la main, elle passe avant la recherche si le quota manque.
  const unresolved = []
  if (WITH_CANDIDATES) {
    for (const name of readList('candidats.txt')) {
      try {
        const id = await resolveCandidate(name)
        if (!id) unresolved.push(name)
        else if (known.has(id)) console.log(`⏭️  ${name} : déjà sur Backed`)
        else add(id, `liste (${name})`)
      } catch (err) {
        unresolved.push(`${name} (${err.message})`)
        if (quotaExhausted) break
      }
    }
  }

  const after = new Date(Date.now() - DAYS * 864e5).toISOString()
  for (const [q, videoDuration] of QUERIES) {
    if (quotaExhausted || !canSearch()) break
    try {
      const data = await yt('search', {
        part: 'snippet', type: 'video', maxResults: '50', regionCode: 'FR', relevanceLanguage: 'fr',
        publishedAfter: after, order: 'viewCount', videoDuration, q,
      }, 100)
      for (const it of data.items || []) add(it.snippet.channelId, `recherche « ${q} »`)
      console.log(`🔎 « ${q} » (${videoDuration}) : ${pool.size} chaînes candidates`)
    } catch (err) {
      console.error(`⚠️  Recherche « ${q} » : ${err.message}`)
    }
  }

  const channels = await channelsInfo([...pool.keys()])
  const rows = []
  const setAside = []
  for (const ch of channels) {
    if (isExcluded(ch, excluded)) continue
    const subs = Number(ch.statistics?.subscriberCount || 0)
    const fromList = [...pool.get(ch.id).via].some((v) => v.startsWith('liste'))
    const label = ch.snippet.title
    if (subs < MIN_SUBSCRIBERS && !fromList) continue
    const country = (ch.snippet.country || '').toUpperCase()
    // Pays déclaré hors liste : écarté sans dépenser de quota.
    if (country && !COUNTRIES.includes(country) && !fromList) continue
    let s
    try {
      s = await study(ch)
    } catch (err) {
      console.error(`⚠️  ${label} : ${err.message}`)
      if (fromList) setAside.push(`${label} (non étudiée : ${err.message})`)
      continue
    }
    // Pas de pays déclaré : on garde seulement si les vidéos sont en français.
    if (!country && !s.french && !fromList) continue
    const share = s.long ? s.sponsored / s.long : 0
    const ratio = subs ? s.medianViews / subs : 0
    const why = []
    if (s.uploads90 < MIN_UPLOADS_90) why.push(`${s.uploads90} vidéo(s) longue(s) en 90 j`)
    if (s.sponsored < MIN_SPONSORED) why.push(`${s.sponsored} vidéo(s) sponsorisée(s) sur ${s.long}`)
    if (why.length) {
      if (fromList) setAside.push(`${label} : ${why.join(', ')}`)
      continue
    }
    rows.push({
      title: label,
      id: ch.id,
      handle: ch.snippet.customUrl || '',
      country: ch.snippet.country || '',
      subs,
      medianViews: s.medianViews,
      ratio,
      engagement: s.engagement,
      sponsored: s.sponsored,
      long: s.long,
      share,
      uploads90: s.uploads90,
      lastLong: s.lastLong,
      codes: s.codes.slice(0, 4),
      brands: s.brands,
      via: viaLabel(pool.get(ch.id).via),
      // Sponsos réguliers × audience × communauté active (vues/abonnés, de ×0,25 à ×2).
      score: share * Math.log10(Math.max(subs, 10)) * Math.min(2, Math.max(0.25, ratio / REF_RATIO)),
    })
  }
  rows.sort((a, b) => b.score - a.score || b.subs - a.subs)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const md = [
    `# Créateurs à découvrir`,
    ``,
    `Chaînes absentes de Backed, sur leurs ${LONG_VIDEOS} dernières vidéos longues (Shorts exclus). Classement : part de vidéos sponsorisées × audience × vues médianes rapportées aux abonnés (repère : ${pct(REF_RATIO)}). Gardées : au moins ${MIN_UPLOADS_90} vidéos longues sur 90 jours et ${MIN_SPONSORED} vidéos sponsorisées. Chaînes françaises (pays ${COUNTRIES.join(', ')}, ou sans pays mais vidéos en français), seuil ${fmt(MIN_SUBSCRIBERS)} abonnés (sauf liste). Quota YouTube utilisé : ${fmt(quotaUsed)} unités.`,
    ``,
    `| # | Chaîne | Abonnés | Vues médianes | Vues / abonnés | Vidéos sponsorisées | Vidéos 90 j | Marques (liens) | Exemples de codes | Trouvée via |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
    ...rows.map((r, i) => `| ${i + 1} | [${r.title}](https://www.youtube.com/channel/${r.id})${r.handle ? ` ${r.handle}` : ''} | ${fmt(r.subs)} | ${fmt(Math.round(r.medianViews))} | ${pct(r.ratio)} | ${r.sponsored}/${r.long} | ${r.uploads90} | ${r.brands.length ? `${r.brands.length} : ${r.brands.slice(0, 4).join(', ')}` : '—'} | ${r.codes.join(', ') || '—'} | ${r.via} |`),
    ``,
    setAside.length ? `**Liste, écartées :** ${setAside.join(' · ')}` : '',
    ``,
    unresolved.length ? `**Introuvables dans la liste :** ${unresolved.join(', ')}` : '',
  ].join('\n')
  fs.writeFileSync(path.join(OUT_DIR, 'createurs.md'), md)
  fs.writeFileSync(
    path.join(OUT_DIR, 'createurs.csv'),
    ['rang,chaine,handle,channel_id,abonnes,vues_medianes,vues_sur_abonnes,engagement,videos_sponsorisees,videos_longues,videos_90j,derniere_video,marques,exemples_codes,pays,trouvee_via,score',
      ...rows.map((r, i) => [i + 1, r.title, r.handle, r.id, r.subs, Math.round(r.medianViews), r.ratio.toFixed(3), r.engagement.toFixed(4), r.sponsored, r.long, r.uploads90, r.lastLong, r.brands.join(' '), r.codes.join(' '), r.country, r.via, r.score.toFixed(3)].map(csvCell).join(','))].join('\n'),
  )
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n')
  console.log(md)
}

// Inspection détaillée de quelques chaînes (@pseudo, identifiant UC… ou nom) : pour chacune,
// ses dernières vidéos longues avec les lignes sponsor de la description. ~3 unités par chaîne.
async function inspect(names) {
  const ids = []
  const unresolved = []
  for (const n of names) {
    try {
      const id = await resolveCandidate(n)
      id ? ids.push(id) : unresolved.push(n)
    } catch (err) {
      unresolved.push(`${n} (${err.message})`)
    }
  }
  const out = [`# Inspection de ${ids.length} chaîne(s)`, '']
  for (const ch of await channelsInfo(ids)) {
    const subs = Number(ch.statistics?.subscriberCount || 0)
    let s
    try {
      s = await study(ch)
    } catch (err) {
      out.push(`## ${ch.snippet.title}`, '', `Non étudiée : ${err.message}`, '')
      continue
    }
    out.push(
      `## [${ch.snippet.title}](https://www.youtube.com/channel/${ch.id}) ${ch.snippet.customUrl || ''}`,
      '',
      `${fmt(subs)} abonnés · pays ${ch.snippet.country || '—'} · vues médianes ${fmt(Math.round(s.medianViews))} (${pct(subs ? s.medianViews / subs : 0)} des abonnés) · ${s.sponsored}/${s.long} vidéos sponsorisées · ${s.uploads90} vidéos longues en 90 j`,
      '',
      `Marques (liens) : ${s.brands.join(', ') || '—'} · liens permanents : ${s.permanent.join(', ') || '—'}`,
      '',
      ...s.videos.map((v) => `- ${v.date} · ${fmt(v.views)} vues · ${v.title}${v.placement ? ' · [communication commerciale]' : ''}${v.lines.length ? `\n  - ${v.lines.join('\n  - ')}` : ''}`),
      '',
    )
  }
  if (unresolved.length) out.push(`Introuvables : ${unresolved.join(', ')}`, '')
  out.push(`Quota YouTube utilisé : ${fmt(quotaUsed)} unités.`)
  const md = out.join('\n')
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'inspection.md'), md)
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n')
  console.log(md)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
