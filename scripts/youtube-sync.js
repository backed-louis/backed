const Airtable = require('airtable')
const { isLinkOffer, endDateFromText, BLACK_FRIDAY, blackFridayFromText } = require('./lib/offres')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Nombre maximum de vidéos remontées par créateur à chaque run (vidéos longues seulement :
// les Shorts n'ont presque jamais de code et occupaient la fenêtre des chaînes qui en postent beaucoup).
const MAX_VIDEOS_PER_CREATOR = 15
// En dessous de cette durée, c'est un Short (jusqu'à 3 min) : ignoré.
const SHORT_MAX_SECONDS = 180
// Pages de 50 vidéos parcourues au plus pour trouver les vidéos longues.
const MAX_PLAYLIST_PAGES = 4
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
  'short.gy', 'urls.fr', 'lnk.to', 'geni.us', 'rebrand.ly', 'tidd.ly', 'ow.ly', 'hfly.co',
]

// ─── État chargé une seule fois au démarrage ─────────────────────────────────

const brandsByKey = new Map()   // nom normalisé -> id de la marque
const brandNames = []           // noms de marques existantes, transmis à Claude pour éviter les variantes
const usedBrandSlugs = new Set()
const knownVideoIds = new Set()
const knownOffers = new Map()   // clé d'offre -> offre existante la plus récente { id, active, seen, end }

let errorCount = 0
let createdOffersCount = 0
let skippedOffersCount = 0
let refreshedOffersCount = 0
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

  // Toutes les offres, actives ET inactives : une offre déjà connue n'est jamais recréée.
  // Si le créateur la repartage dans une nouvelle vidéo, on la met à jour (« Vu le », réactivation).
  // Attention : via l'API, un champ lié renvoie des IDs d'enregistrements (pas des noms).
  const offers = await base('Offers').select({ fields: ['Code', 'Brand', 'Creator', 'Source URL', 'Status', 'Vu le', 'End Date', 'Created time', 'Black Friday', 'Benefit'] }).all()
  for (const r of offers) {
    const creatorId = r.fields['Creator']?.[0]
    if (!creatorId) continue
    const brandId = r.fields['Brand']?.[0] || ''
    const key = offerKey(creatorId, brandId, r.fields['Code'], r.fields['Source URL'])
    const created = r.fields['Created time'] || ''
    const current = knownOffers.get(key)
    if (current && current.created > created) continue
    knownOffers.set(key, {
      id: r.id,
      created,
      active: r.fields['Status'] === 'Active',
      seen: r.fields['Vu le'] || null,
      end: r.fields['End Date'] || null,
      bf: Boolean(r.fields['Black Friday']),
      benefit: r.fields['Benefit'] || '',
    })
  }

  const videos = await base('Videos Inbox').select({ fields: ['Video ID'] }).all()
  for (const r of videos) {
    if (r.fields['Video ID']) knownVideoIds.add(r.fields['Video ID'])
  }

  console.log(`🗂️  État chargé : ${brandsByKey.size} marques, ${knownOffers.size} offres, ${knownVideoIds.size} vidéos déjà vues`)
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
    `      "endDate": "YYYY-MM-DD ou null",`,
    `      "blackFriday": true ou false`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `Règles:`,
    `- Ne retourne que de vrais codes promo ou liens affiliés avec un vrai avantage chiffré ou concret`,
    `- Ignore les mentions de réseaux sociaux`,
    `- Ignore les mots génériques (YOUTUBE, ABONNE, etc.)`,
    `- Ignore ce que le créateur vend lui-même (sa boutique, son merch, sa formation, son kit, sa newsletter) : seulement les offres d'une marque partenaire. Exception : si la chaîne est la chaîne officielle d'une marque, ses propres offres comptent.`,
    `- Un simple prix ("12 €/mois") ou un service gratuit pour tout le monde ("application gratuite", "envoi gratuit de fichiers") n'est pas un avantage : ignore-les.`,
    `- Ignore les codes à usage unique (bon cadeau du type "AB12-CD34-EF56") et les codes qui ne sont pas un mot ou une suite de caractères à taper (une phrase n'est pas un code).`,
    `- Si aucun code trouvé, retourne {"codes": []}`,
    `- Le champ "code" doit être null si c est uniquement un lien affilié sans code (ex: "Téléchargez Revolut avec ce lien … 20 € offerts" → code null, url = le lien, benefit = "20 € offerts …")`,
    `- Le champ "url" doit être null si pas de lien spécifique`,
    `- IMPORTANT pour "brand": renvoie le nom commercial propre de l'annonceur (la société ou le service qui propose l'offre), ex: "NordVPN", "HelloFresh", "Revolut". JAMAIS un nom de domaine ou une URL, JAMAIS le nom du créateur, JAMAIS la description d'un produit, JAMAIS de parenthèses. Pour un lien affilié vers un produit, renvoie la marque qui le vend ou le fabrique (ex: "Amazon", "MSI"). Si tu ne peux pas identifier la marque avec certitude, renvoie null.`,
    `- Marques déjà connues : ${knownBrands}. Si l'annonceur correspond à l'une d'elles (même sous une variante comme "Emma Sleep" pour "Emma" ou "Scuf Gaming" pour "Scuf"), utilise EXACTEMENT son nom de cette liste. N'invente une nouvelle marque que si elle n'est pas dans la liste.`,
    `- "blackFriday": true si l'offre est présentée comme une offre Black Friday, Black Week, Black November ou Cyber Monday, sinon false.`,
    `- "endDate": si la description indique une date de fin ou de validité, même dans une phrase séparée du lien (ex: "jusqu'au 14 mars", "valable jusqu'à fin 2026", "L'offre se termine le 30/09/2026"), renvoie-la au format YYYY-MM-DD en déduisant l'année la plus plausible à partir de la date de publication de la vidéo. Sinon renvoie null. N'invente jamais de date.`,
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

// « PT1H2M3S » -> secondes
function durationSeconds(iso) {
  const m = String(iso || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0)
}

// Les MAX_VIDEOS_PER_CREATOR dernières vidéos longues (Shorts, lives et premières à venir exclus),
// avec leur description. Une page de 50 vidéos coûte 2 unités de quota (liste + détails).
async function getRecentVideos(channelId) {
  const uploadsId = await getUploadsPlaylistId(channelId)
  if (!uploadsId) return []

  // Date limite : aujourd'hui moins MAX_AGE_MONTHS mois.
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - MAX_AGE_MONTHS)

  const videos = []
  let pageToken = ''
  let pages = 0
  let reachedOld = false
  let shorts = 0

  // La playlist uploads est triée du plus récent au plus ancien.
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
    pages++
    if (!data.items?.length) break

    const page = []
    for (const item of data.items) {
      const publishedAt = item.snippet.publishedAt
      if (publishedAt && new Date(publishedAt) < cutoff) {
        reachedOld = true
        break
      }
      page.push({ videoId: item.snippet.resourceId.videoId, title: item.snippet.title, publishedAt })
    }

    if (page.length) {
      const det = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}` +
        `&id=${page.map((v) => v.videoId).join(',')}&part=snippet,contentDetails`)
      const detData = await det.json()
      assertYoutubeOk(detData, 'videos')
      const byId = new Map((detData.items || []).map((it) => [it.id, it]))
      for (const v of page) {
        const it = byId.get(v.videoId)
        if (!it) continue // vidéo privée ou supprimée
        if (it.snippet?.liveBroadcastContent && it.snippet.liveBroadcastContent !== 'none') continue
        if (durationSeconds(it.contentDetails?.duration) <= SHORT_MAX_SECONDS) { shorts++; continue }
        videos.push({ ...v, description: it.snippet?.description || '', url: `https://www.youtube.com/watch?v=${v.videoId}` })
        if (videos.length >= MAX_VIDEOS_PER_CREATOR) break
      }
    }

    pageToken = data.nextPageToken || ''
  } while (pageToken && videos.length < MAX_VIDEOS_PER_CREATOR && !reachedOld && pages < MAX_PLAYLIST_PAGES)

  if (shorts) console.log(`  ⏭️  ${shorts} Short(s) ignoré(s)`)
  return videos
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

// Code à usage unique (bon cadeau « B7YB-S4TC-TZXR ») : une seule personne peut s'en servir.
const SINGLE_USE_CODE = /^[A-Z0-9]{4}(-[A-Z0-9]{4}){2,}$/i

async function createOffer(code, brand, benefit, sourceUrl, endDate, creatorId, creatorName, seenDate, blackFriday = false) {
  // Une phrase (« Le voyage de Bruno ») n'est pas un code : l'offre est traitée comme un lien.
  if (code && /\s/.test(String(code).trim())) code = null
  if (code && SINGLE_USE_CODE.test(String(code).trim())) {
    console.log(`  ⏭️  Code à usage unique ignoré : ${code} (${brand})`)
    skippedOffersCount++
    return
  }
  const label = code || 'lien'
  // Backed affiche les codes promo, et les liens personnels du créateur avec un avantage chiffré
  // (ex. Revolut : « 20 € offerts » via get.revolut.com/…/SQueezie). Un lien sans avantage, ou
  // sans lien propre à l'offre, n'est pas enregistré (et ne crée donc pas de marque).
  if (!code && !isLinkOffer({ code, sourceUrl, benefit })) {
    console.log(`  ⏭️  Lien sans avantage chiffré ignoré (${brand})`)
    skippedOffersCount++
    return
  }

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
  const seen = seenDate || todayString()
  const existing = knownOffers.get(key)
  if (existing) {
    // Offre déjà connue, repartagée dans une nouvelle vidéo : elle est toujours d'actualité.
    const fields = {}
    if (!existing.seen || seen > existing.seen) fields['Vu le'] = seen
    if (end && end !== existing.end) fields['End Date'] = end
    else if (!end && existing.end && existing.end < todayString()) fields['End Date'] = null // nouvelle campagne sans date
    if (!existing.active) fields['Status'] = 'Active'
    if (blackFriday && !existing.bf) fields['Black Friday'] = true
    // Avantage vague (« Offre spéciale ») remplacé par l'avantage chiffré de la nouvelle vidéo.
    if (benefit && /\d/.test(benefit) && !/\d/.test(existing.benefit || '')) fields['Benefit'] = benefit
    if (Object.keys(fields).length) {
      await base('Offers').update([{ id: existing.id, fields }])
      Object.assign(existing, { active: true, seen: fields['Vu le'] || existing.seen, end: 'End Date' in fields ? fields['End Date'] : existing.end, bf: existing.bf || blackFriday, benefit: fields['Benefit'] || existing.benefit })
      refreshedOffersCount++
      console.log(`  🔄 Offre repartagée, mise à jour : ${label} (${brand}) — ${Object.keys(fields).join(', ')}`)
    } else {
      console.log(`  ⏭️  Doublon ignoré : ${label} (${brand})`)
      skippedOffersCount++
    }
    return
  }

  const slug = `${(brand || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${creatorName.toLowerCase().replace(/\s+/g, '-')}`
  const fields = {
    'Code': code || '',
    'Benefit': benefit,
    'Status': 'Active',
    'Source URL': sourceUrl || '',
    'Creator': [creatorId],
    'Brand': [brandId],
    'Slug': slug,
    'Vu le': seen,
  }
  if (end) fields['End Date'] = end
  if (blackFriday) fields['Black Friday'] = true

  const created = await base('Offers').create([{ fields }])
  knownOffers.set(key, { id: created[0].id, created: new Date().toISOString(), active: true, seen, end: end || null, bf: Boolean(blackFriday) })
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
      console.log(`  📺 ${videos.length} vidéos longues remontées depuis la playlist`)

      for (const video of videos) {
        if (knownVideoIds.has(video.videoId)) continue

        const description = video.description

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
          // Date de fin : celle lue par Claude, sinon celle écrite près de l'offre dans la description.
          const endDate = c.endDate || endDateFromText(description, [c.code, c.url], publishedDate)
          // Offre Black Friday : vue par Claude, ou écrite dans le texte de l'offre ou près d'elle.
          const blackFriday = c.blackFriday === true || BLACK_FRIDAY.test(`${c.benefit || ''} ${c.code || ''}`) || blackFridayFromText(description, [c.code, c.url])
          await createOffer(c.code, c.brand, c.benefit, c.url || video.url, endDate, creator.id, creator.name, publishedDate, blackFriday)
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

  console.log(`\n✅ Sync terminé : ${totalVideos} vidéos, ${totalCodes} codes détectés, ${createdOffersCount} offres créées, ${refreshedOffersCount} repartagées, ${skippedOffersCount} ignorées, ${createdBrandsCount} marques créées, ${errorCount} erreur(s)`)

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
