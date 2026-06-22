const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Nombre maximum de vidéos remontées par créateur à chaque run.
// Le bot s'arrête de paginer dès qu'il atteint cette limite.
const MAX_VIDEOS_PER_CREATOR = 200

const createdOffers = new Set()

async function detectCodesWithClaude(description, creatorName) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: `Tu es un expert en marketing d'influence YouTube français. Analyse cette description de vidéo YouTube du créateur "${creatorName}" et extrait les codes promo/liens affiliés.\n\nDescription:\n${description.slice(0, 3000)}\n\nRéponds UNIQUEMENT en JSON avec ce format exact, sans markdown:\n{\n  "codes": [\n    {\n      "code": "CODE_PROMO",\n      "brand": "Nom de la marque",\n      "benefit": "Description de l avantage",\n      "url": "https://lien-ou-null"\n    }\n  ]\n}\n\nRègles:\n- Ne retourne que de vrais codes promo ou liens affiliés avec un vrai avantage chiffré ou concret\n- Ignore les mentions de réseaux sociaux\n- Ignore les mots génériques (YOUTUBE, ABONNE, etc.)\n- Si aucun code trouvé, retourne {"codes": []}\n- Le champ "code" doit être null si c est uniquement un lien affilié sans code\n- Le champ "url" doit être null si pas de lien spécifique` }],
    }),
  })
  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)
  const data = await response.json()
  try { return JSON.parse(data.content[0].text.trim()).codes || [] } catch { return [] }
}

async function getUploadsPlaylistId(channelId) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&id=${channelId}&part=contentDetails`)
  const data = await res.json()
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
}

async function getRecentVideos(channelId) {
  const uploadsId = await getUploadsPlaylistId(channelId)
  if (!uploadsId) return []

  const videos = []
  let pageToken = ''

  // Pagination : on remonte par pages de 50 jusqu'à MAX_VIDEOS_PER_CREATOR
  // ou jusqu'à épuisement de la playlist.
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems` +
      `?key=${YOUTUBE_API_KEY}` +
      `&playlistId=${uploadsId}` +
      `&part=snippet` +
      `&maxResults=50` +
      (pageToken ? `&pageToken=${pageToken}` : '')

    const res = await fetch(url)
    const data = await res.json()
    if (!data.items) break

    for (const item of data.items) {
      videos.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      })
    }

    pageToken = data.nextPageToken || ''
  } while (pageToken && videos.length < MAX_VIDEOS_PER_CREATOR)

  return videos
}

async function getVideoDescription(videoId) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoId}&part=snippet,contentDetails`)
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null
  const duration = item.contentDetails?.duration || ''
  const isShort = /^PT(\d+S|[0-5]?\dS)$/.test(duration)
  if (isShort) return null
  return item.snippet?.description || ''
}

async function videoExists(videoId) {
  const records = await base('Videos Inbox').select({ filterByFormula: `{Video ID} = "${videoId}"`, maxRecords: 1 }).firstPage()
  return records.length > 0
}

async function getCreators() {
  const records = await base('Creators').select({ fields: ['Name', 'Channel ID'] }).all()
  return records.map(r => ({ id: r.id, name: r.fields['Name'], channelId: r.fields['Channel ID'] })).filter(c => c.channelId)
}

async function getBrandId(brandName) {
  const records = await base('Brands').select({ filterByFormula: `{Name} = "${brandName}"`, maxRecords: 1 }).firstPage()
  return records[0]?.id || null
}

async function offerExists(code, brand, creatorId) {
  if (code) {
    const records = await base('Offers').select({
      filterByFormula: `AND({Code} = "${code}", FIND("${creatorId}", ARRAYJOIN({Creator})))`,
      maxRecords: 1
    }).firstPage()
    return records.length > 0
  } else {
    const brandId = await getBrandId(brand)
    if (!brandId) return false
    const records = await base('Offers').select({
      filterByFormula: `AND(FIND("${brandId}", ARRAYJOIN({Brand})), FIND("${creatorId}", ARRAYJOIN({Creator})), {Code} = "")`,
      maxRecords: 1
    }).firstPage()
    return records.length > 0
  }
}

async function createOffer(code, brand, benefit, sourceUrl, creatorId, creatorName) {
  if (!code && !benefit) return

  const key = `${code || 'null'}|${brand}|${creatorId}`
  if (createdOffers.has(key)) {
    console.log(`  ⏭️  Doublon ignoré : ${code || 'lien affilié'} (${brand})`)
    return
  }

  const exists = await offerExists(code, brand, creatorId)
  if (exists) {
    console.log(`  ⏭️  Doublon ignoré : ${code || 'lien affilié'} (${brand})`)
    createdOffers.add(key)
    return
  }

  createdOffers.add(key)
  const brandId = await getBrandId(brand)
  const slug = `${(brand || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${creatorName.toLowerCase().replace(/\s+/g, '-')}`
  const fields = { 'Code': code || '', 'Benefit': benefit, 'Status': 'Active', 'Source URL': sourceUrl || '', 'Creator': [creatorId], 'Slug': slug }
  if (brandId) fields['Brand'] = [brandId]
  await base('Offers').create([{ fields }])
  console.log(`  ✅ Offre créée : ${code || 'lien affilié'} (${brand}) — ${benefit}`)
}

async function main() {
  console.log('🚀 Démarrage sync YouTube → Airtable (avec Claude)')
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
        const exists = await videoExists(video.videoId)
        if (exists) continue
        const description = await getVideoDescription(video.videoId)
        if (description === null) { console.log(`  ⏭️  Short ignoré : ${video.title}`); continue }
        const codes = await detectCodesWithClaude(description, creator.name)
        console.log(`  📹 ${video.title} → ${codes.length} code(s) détecté(s)`)
        await base('Videos Inbox').create([{ fields: {
          'Video ID': video.videoId,
          'Video URL': video.url,
          'Title': video.title,
          'Description': description.slice(0, 5000),
          'Published At': video.publishedAt ? video.publishedAt.split('T')[0] : null,
          'Creator': [creator.id],
          'Detected Codes': codes.filter(c => c.code).map(c => c.code).join(', '),
          'Processed': false
        } }])
        for (const c of codes) {
          await createOffer(c.code, c.brand, c.benefit, c.url || video.url, creator.id, creator.name)
          totalCodes++
        }
        totalVideos++
      }
    } catch (err) { console.error(`  ❌ ${creator.name}:`, err.message) }
  }
  console.log(`\n✅ Sync terminé : ${totalVideos} vidéos, ${totalCodes} codes détectés`)
}

main().catch(console.error)
