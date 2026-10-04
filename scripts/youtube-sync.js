const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Nombre maximum de vidéos remontées par créateur à chaque run.
const MAX_VIDEOS_PER_CREATOR = 15
// On ignore les vidéos publiées il y a plus de X mois.
const MAX_AGE_MONTHS = 6
// Petit délai (ms) entre deux appels à l'API Claude pour éviter le rate-limit.
const CLAUDE_DELAY_MS = 200

// Hôtes de liens raccourcis / trackers / YouTube : ils ne donnent PAS le site de la marque,
// on ne s'en sert donc jamais pour renseigner le champ Website d'une marque.
const NON_BRAND_HOSTS = [
  'youtube.com', 'youtu.be', 'bit.ly', 'urlr.me', 'cutt.ly', 'shorturl.at', 'tinyurl.com',
  'amzn.to', 'go.link', 'onelink.me', 'adjust.com', 'taap.it', 'sldrsn.com', 'flg.top',
  'pwgam.es', 'ubi.li', 'wehy.pe', 'bnent.eu', 'geolink.xtb.com', 'skyy.fr', 'linktr.ee',
]

// ─── État chargé une seule fois au démarrage ─────────────────────────────────

const brandsByKey = new Map()   // nom normalisé -> id de la marque
const brandNames = []           // noms de marques existantes, transmis à Claude pour éviter les variantes
const usedBrandSlugs = new Set()
const knownVideoIds = new Set()
const knownOfferKeys = new Set()

let errorCount = 0
let createdOffersCount = 0
let skippedOffersCount = 0
let createdBrandsCount = 0

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Clé de comparaison d'un nom de marque : "Fitness Boutique" = "fitnessboutique" = "Fitness-Boutique"
function normKey(s) {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function slugify(s) {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function normUrl(u) {
  return String(u || '').split('?')[0].split('#')[0].toLowerCase().replace(/\/+$/, '')
}

function todayString() {
  return new Date().toISOString().split('T')[0]
}

function brandWebsiteFrom(sourceUrl) {
  try {
    const u = new URL(sourceUrl)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (NON_BRAND_HOSTS.some(h => host === h || host.endsWith('.' + h))) return null
    return u.origin
  } catch {
    return null
  }
}

function parseEndDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : String(value)
}

// Clé unique d'une offre : une seule offre par (créateur, marque, code) ou, sans code, par (créateur, marque, lien).
function offerKey(creatorId, brandId, code, url) {
  const c = String(code || '').trim().toLowerCase()
  return c
    ? `${creatorId}|${brandId || ''}|code|${c}`
    : `${creatorId}|${brandId || ''}|url|${normUrl(url)}`
}

// ─── Chargement initial (marques, offres existantes, vidéos déjà vues) ───────

async function loadState() {
  const brands = await base('Brands').select({ fields: ['Name', 'slug'] }).all()
  for (const r of brands) {
    const key = normKey(r.fields['Name'])
    if (key) brandsByKey.set(key, r.id)
    if (r.fields['Name']) brandNames.push(r.fields['Name'])
    if (r.fields['slug']) usedBrandSlugs.add(r.fields['slug'])
  }

  // Toutes les offres, actives ET inactives : une offre désactivée ne doit pas être recréée.
  // Attention : via l'API, un champ lié renvoie des IDs d'enregistrements (pas des noms).
  const offers = await base('Offers').select({ fields: ['Code', 'Brand', 'Creator', 'Source URL'] }).all()
  for (const r of offers) {
    const creatorId = r.fields['Creator']?.[0]
    if (!creatorId) continue
    const brandId = r.fields['Brand']?.[0] || ''
    knownOfferKeys.add(offerKey(creatorId, brandId, r.fields['Code'], r.fields['Source URL']))
  }

  const videos = await base('Videos Inbox').select({ fields: ['Video ID'] }).all()
  for (const r of videos) {
    if (r.fields['Video ID']) knownVideoIds.add(r.fields['Video ID'])
  }

  console.log(`🗂️  État chargé : ${brandsByKey.size} marques, ${knownOfferKeys.size} offres, ${knownVideoIds.size} vidéos déjà vues`)
}

// ─── Claude ──────────────────────────────────────────────────────────────────

async function detectCodesWithClaude(description, creatorName, publishedDate) {
  const knownBrands = brandNames.join(', ')
  const prompt = [
    `Tu es un expert en marketing d'influence YouTube français. Analyse cette description de vidéo YouTube du créateur "${creatorName}" et extrait les codes promo/liens affiliés.`,
    ``,
    `Date du jour : ${todayString()}. Date de publication de la vidéo : ${publishedDate || 'inconnue'}.`,
    ``,
    `Description:`,
    description.slice(0, 3000),
    ``,
    `Réponds UNIQUEMENT en JSON avec ce format exact, sans markdown:`,
    `{`,
    `  "codes": [`,
    `    {`,
    `      "code": "CODE_PROMO",`,
    `      "brand": "Nom de la marque",`,
    `      "benefit": "Description de l avantage",`,
    `      "url": "https://lien-ou-null",`,
    `      "endDate": "YYYY-MM-DD ou null"`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `Règles:`,
    `- Ne retourne que de vrais codes promo ou liens affiliés avec un vrai avantage chiffré ou concret`,
    `- Ignore les mentions de réseaux sociaux`,
    `- Ignore les mots génériques (YOUTUBE, ABONNE, etc.)`,
    `- Si aucun code trouvé, retourne {"codes": []}`,
    `- Le champ "code" doit être null si c est uniquement un lien affilié sans code`,
    `- Le champ "url" doit être null si pas de lien spécifique`,
    `- IMPORTANT pour "brand": renvoie le nom commercial propre de l'annonceur (la société ou le service qui propose l'offre), ex: "NordVPN", "HelloFresh", "Revolut". JAMAIS un nom de domaine ou une URL, JAMAIS le nom du créateur, JAMAIS la description d'un produit, JAMAIS de parenthèses. Pour un lien affilié vers un produit, renvoie la marque qui le vend ou le fabrique (ex: "Amazon", "MSI"). Si tu ne peux pas identifier la marque avec certitude, renvoie null.`,
    `- Marques déjà connues : ${knownBrands}. Si l'annonceur correspond à l'une d'elles (même sous une variante comme "Emma Sleep" pour "Emma" ou "Scuf Gaming" pour "Scuf"), utilise EXACTEMENT son nom de cette liste. N'invente une nouvelle marque que si elle n'est pas dans la liste.`,
    `- "endDate": si la description indique une date de fin ou de validité (ex: "jusqu'au 14 mars", "valable jusqu'à fin 2026"), renvoie-la au format YYYY-MM-DD en déduisant l'année la plus plausible à partir de la date de publication de la vidéo. Sinon renvoie null. N'invente jamais de date.`,
  ].join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Claude API ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = await response.json()
  const text = (data.content?.[0]?.text || '').trim()
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned).codes || []
  } catch {
    return []
  }
}

// ─── YouTube ─────────────────────────────────────────────────────────────────

function assertYoutubeOk(data, context) {
  if (data && data.error) {
    throw new Error(`YouTube API (${context}) ${data.error.code || ''}: ${data.error.message || 'erreur inconnue'}`)
  }
}

async function getUploadsPlaylistId(channelId) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&id=${channelId}&part=contentDetails`)
  const data = await res.json()
  assertYoutubeOk(data, 'channels')
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
}

async function getRecentVideos(channelId) {
  const uploadsId = await getUploadsPlaylistId(channelId)
  if (!uploadsId) return []

  // Date limite : aujourd'hui moins MAX_AGE_MONTHS mois.
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - MAX_AGE_MONTHS)

  const videos = []
  let pageToken = ''
  let reachedOld = false

  // Pagination : on remonte par pages de 50 jusqu'à MAX_VIDEOS_PER_CREATOR,
  // ou jusqu'à tomber sur une vidéo plus vieille que la date limite
  // (la playlist uploads est triée du plus récent au plus ancien).
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems` +
      `?key=${YOUTUBE_API_KEY}` +
      `&playlistId=${uploadsId}` +
      `&part=snippet` +
      `&maxResults=50` +
      (pageToken ? `&pageToken=${pageToken}` : '')

    const res = await fetch(url)
    const data = await res.json()
    assertYoutubeOk(data, 'playlistItems')
    if (!data.items) break

    for (const item of data.items) {
      const publishedAt = item.snippet.publishedAt
      if (publishedAt && new Date(publishedAt) < cutoff) {
        reachedOld = true
        break
      }
      videos.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        publishedAt,
        url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      })
      if (videos.length >= MAX_VIDEOS_PER_CREATOR) break
    }

    pageToken = data.nextPageToken || ''
  } while (pageToken && videos.length < MAX_VIDEOS_PER_CREATOR && !reachedOld)

  return videos
}

async function getVideoDescription(videoId) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoId}&part=snippet,contentDetails`)
  const data = await res.json()
  assertYoutubeOk(data, 'videos')
  const item = data.items?.[0]
  if (!item) return null
  const duration = item.contentDetails?.duration || ''
  const isShort = /^PT(\d+S|[0-5]?\dS)$/.test(duration)
  if (isShort) return null
  return item.snippet?.description || ''
}

// ─── Airtable ────────────────────────────────────────────────────────────────

async function getCreators() {
  const records = await base('Creators').select({ fields: ['Name', 'Channel ID'] }).all()
  return records.map(r => ({ id: r.id, name: r.fields['Name'], channelId: r.fields['Channel ID'] })).filter(c => c.channelId)
}

// Retourne l'id de la marque, en la créant si elle n'existe pas encore
// (sans marque, une offre n'est pas affichée sur le site).
async function getOrCreateBrand(name, sourceUrl) {
  const cleanName = String(name || '').trim()
  // Un nom avec parenthèses est presque toujours un produit ou un nom de créateur, pas une marque.
  if (!cleanName || cleanName.length > 60 || /[()]/.test(cleanName)) return null

  const key = normKey(cleanName)
  if (!key) return null
  if (brandsByKey.has(key)) return brandsByKey.get(key)

  const baseSlug = slugify(cleanName) || key
  let slug = baseSlug
  let i = 2
  while (usedBrandSlugs.has(slug)) slug = `${baseSlug}-${i++}`

  const fields = { 'Name': cleanName, 'slug': slug }
  const website = brandWebsiteFrom(sourceUrl)
  if (website) fields['Website'] = website

  const created = await base('Brands').create([{ fields }])
  const brandId = created[0].id
  brandsByKey.set(key, brandId)
  usedBrandSlugs.add(slug)
  brandNames.push(cleanName)
  createdBrandsCount++
  console.log(`  🏷️  Marque créée : ${cleanName} (${slug})`)
  return brandId
}

async function createOffer(code, brand, benefit, sourceUrl, endDate, creatorId, creatorName) {
  const label = code || 'lien affilié'
  if (!code && !benefit) return

  const end = parseEndDate(endDate)
  if (end && end < todayString()) {
    console.log(`  ⏭️  Offre déjà expirée ignorée : ${label} (${brand}) — fin ${end}`)
    skippedOffersCount++
    return
  }

  const brandId = await getOrCreateBrand(brand, sourceUrl)
  if (!brandId) {
    console.log(`  ⏭️  Marque inconnue, offre ignorée : ${label}`)
    skippedOffersCount++
    return
  }

  const key = offerKey(creatorId, brandId, code, sourceUrl)
  if (knownOfferKeys.has(key)) {
    console.log(`  ⏭️  Doublon ignoré : ${label} (${brand})`)
    skippedOffersCount++
    return
  }
  knownOfferKeys.add(key)

  const slug = `${(brand || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${creatorName.toLowerCase().replace(/\s+/g, '-')}`
  const fields = {
    'Code': code || '',
    'Benefit': benefit,
    'Status': 'Active',
    'Source URL': sourceUrl || '',
    'Creator': [creatorId],
    'Brand': [brandId],
    'Slug': slug,
  }
  if (end) fields['End Date'] = end

  await base('Offers').create([{ fields }])
  createdOffersCount++
  console.log(`  ✅ Offre créée : ${label} (${brand}) — ${benefit}${end ? ` — fin ${end}` : ''}`)
}

// Passe en Inactive toutes les offres actives dont la date de fin est dépassée.
async function expireOldOffers() {
  const records = await base('Offers').select({
    filterByFormula: 'AND({Status} = "Active", {End Date}, IS_BEFORE({End Date}, TODAY()))',
    fields: ['Status'],
  }).all()

  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10).map(r => ({ id: r.id, fields: { 'Status': 'Inactive' } }))
    await base('Offers').update(batch)
  }
  console.log(`🧹 ${records.length} offre(s) expirée(s) passée(s) en Inactive`)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Démarrage sync YouTube → Airtable (avec Claude)')
  await loadState()

  const creators = await getCreators()
  console.log(`📋 ${creators.length} créateurs trouvés`)

  let totalVideos = 0
  let totalCodes = 0

  for (const creator of creators) {
    console.log(`\n👤 ${creator.name}`)
    try {
      const videos = await getRecentVideos(creator.channelId)
      console.log(`  📺 ${videos.length} vidéos remontées depuis la playlist`)

      for (const video of videos) {
        if (knownVideoIds.has(video.videoId)) continue

        const description = await getVideoDescription(video.videoId)
        if (description === null) { console.log(`  ⏭️  Short ignoré : ${video.title}`); continue }

        const publishedDate = video.publishedAt ? video.publishedAt.split('T')[0] : null

        // Description vide : on n'appelle pas Claude (économie d'API), on enregistre juste la vidéo.
        if (!description.trim()) {
          console.log(`  📹 ${video.title} → description vide, pas d'analyse`)
          await base('Videos Inbox').create([{ fields: {
            'Video ID': video.videoId,
            'Video URL': video.url,
            'Title': video.title,
            'Description': '',
            'Published At': publishedDate,
            'Creator': [creator.id],
            'Detected Codes': '',
            'Processed': false
          } }])
          knownVideoIds.add(video.videoId)
          totalVideos++
          continue
        }

        const codes = await detectCodesWithClaude(description, creator.name, publishedDate)
        await sleep(CLAUDE_DELAY_MS)
        console.log(`  📹 ${video.title} → ${codes.length} code(s) détecté(s)`)

        await base('Videos Inbox').create([{ fields: {
          'Video ID': video.videoId,
          'Video URL': video.url,
          'Title': video.title,
          'Description': description.slice(0, 5000),
          'Published At': publishedDate,
          'Creator': [creator.id],
          'Detected Codes': codes.filter(c => c.code).map(c => c.code).join(', '),
          'Processed': false
        } }])
        knownVideoIds.add(video.videoId)

        for (const c of codes) {
          await createOffer(c.code, c.brand, c.benefit, c.url || video.url, c.endDate, creator.id, creator.name)
          totalCodes++
        }
        totalVideos++
      }
    } catch (err) {
      errorCount++
      console.error(`  ❌ ${creator.name}:`, err.message)
    }
  }

  try {
    await expireOldOffers()
  } catch (err) {
    errorCount++
    console.error('❌ Expiration des offres :', err.message)
  }

  console.log(`\n✅ Sync terminé : ${totalVideos} vidéos, ${totalCodes} codes détectés, ${createdOffersCount} offres créées, ${skippedOffersCount} ignorées, ${createdBrandsCount} marques créées, ${errorCount} erreur(s)`)

  // Si au moins la moitié des créateurs échouent (quota YouTube, crédits Claude, clé invalide...),
  // le job GitHub passe en rouge au lieu de rester vert sans rien faire.
  if (creators.length > 0 && errorCount >= Math.ceil(creators.length / 2)) {
    console.error('🚨 Trop d\'erreurs : le run est considéré comme échoué.')
    process.exitCode = 1
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
