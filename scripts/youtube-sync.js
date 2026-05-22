const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const createdOffers = new Set()

// ─── Claude API ───────────────────────────────────────────────────────────────

async function detectCodesWithClaude(description, creatorName) {
  const prompt = `Tu es un expert en marketing d'influence YouTube français. Analyse cette description de vidéo YouTube du créateur "${creatorName}" et extrait les codes promo/liens affiliés.

Description:
${description.slice(0, 3000)}

Réponds UNIQUEMENT en JSON avec ce format exact, sans markdown:
{
  "codes": [
    {
      "code": "CODE_PROMO",
      "brand": "Nom de la marque",
      "benefit": "Description de l'avantage (ex: 15% de réduction)",
      "url": "https://lien-affilié-si-présent-ou-null"
    }
  ]
}

Règles:
- Ne retourne que de vrais codes promo ou liens affiliés avec un vrai avantage chiffré ou concret
- Ignore les mentions de réseaux sociaux (Instagram, Twitter, etc.)
- Ignore les mots génériques (YOUTUBE, ABONNE, etc.)
- Ignore les liens vers les propres produits du créateur sans avantage concret
- Si aucun code trouvé, retourne {"codes": []}
- Le champ "code" doit être null si c'est uniquement un lien affilié sans code
- Le champ "url" doit être null si pas de lien spécifique`

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.content[0].text.trim()

  try {
    const parsed = JSON.parse(text)
    return parsed.codes || []
  } catch {
    return []
  }
}

// ─── YouTube API ──────────────────────────────────────────────────────────────

async function getUploadsPlaylistId(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&id=${channelId}&part=contentDetails`
  const res = await fetch(url)
  const data = await res.json()
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
}

async function getRecentVideos(channelId) {
  const uploadsId = await getUploadsPlaylistId(channelId)
  if (!uploadsId) return []

  const url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${YOUTUBE_API_KEY}&playlistId=${uploadsId}&part=snippet&maxResults=10`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.items) return []

  return data.items.map(item => ({
    videoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
  }))
}

async function getVideoDescription(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoId}&part=snippet,contentDetails`
  const res = await fetch(url)
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null

  const duration = item.contentDetails?.duration || ''
  const isShort = /^PT(\d+S|[0-5]?\dS)$/.test(duration)
  if (isShort) return null

  return item.snippet?.description || ''
}

// ─── Airtable ─────────────────────────────────────────────────────────────────

async function videoExists(videoId) {
  const records = await base('Videos Inbox')
    .select({ filterByFormula: `{Video ID} = "${videoId}"`, maxRecords: 1 })
    .firstPage()
  return records.length > 0
}

async function getCreators() {
  const records = await base('Creators')
    .select({ fields: ['Name', 'Channel ID'] })
    .all()
  return records
    .map(r => ({
      id: r.id,
      name: r.fields['Name'],
      channelId: r.fields['Channel ID'],
    }))
    .filter(c => c.channelId)
}

async function getBrandId(brandName) {
  const records = await base('Brands')
    .select({ filterByFormula: `{Name} = "${brandName}"`, maxRecords: 1 })
    .firstPage()
  return records[0]?.id || null
}

async function offerExists(code, creatorId) {
  const records = await base('Offers')
    .select({
      filterByFormula: `AND({Code} = "${code}", FIND("${creatorId}", ARRAYJOIN({Creator})))`,
      maxRecords: 1
    })
    .firstPage()
  return records.length > 0
}

async function createOffer(code, brand, benefit, sourceUrl, creatorId, creatorName) {
  if (!code && !benefit) return

  const key = `${code || 'null'}|${brand}|${creatorId}`
  if (createdOffers.has(key)) {
    console.log(`  ⏭️  Doublon ignoré : ${code || 'lien affilié'} (${brand})`)
    return
  }

  if (code && code !== 'lien affilié') {
    const exists = await offerExists(code, creatorId)
    if (exists) {
      console.log(`  ⏭️  Doublon ignoré : ${code} (${brand})`)
      return
    }
  }

  createdOffers.add(key)

  const brandId = await getBrandId(brand)
  const slug = `${(brand || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${creatorName.toLowerCase().replace(/\s+/g, '-')}`

  const fields = {
    'Code': code || '',
    'Benefit': benefit,
    'Status': 'Active',
    'Source URL': sourceUrl || '',
    'Creator': [creatorId],
    'Slug': slug,
  }

  if (brandId) {
    fields['Brand'] = [brandId]
  }

  await base('Offers').create([{ fields }])
  console.log(`  ✅ Offre créée : ${code || 'lien affilié'} (${brand}) — ${benefit}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

      for (const video of videos) {
        const exists = await videoExists(video.videoId)
        if (exists) continue

        const description = await getVideoDescription(video.videoId)
        if (description === null) {
          console.log(`  ⏭️  Short ignoré : ${video.title}`)
          continue
        }

        const codes = await detectCodesWithClaude(description, creator.name)
        console.log(`  📹 ${video.title} → ${codes.length} code(s) détecté(s)`)

        await base('Videos Inbox').create([{
          fields: {
            'Video ID': video.videoId,
            'Video URL': video.url,
            'Title': video.title,
            'Description': description.slice(0, 5000),
            'Published At': video.publishedAt ? video.publishedAt.split('T')[0] : null,
            'Creator': [creator.id],
            'Detected Codes': codes.map(c => c.code).join(', '),
            'Processed': false,
          }
        }])

        for (const c of codes) {
          await createOffer(
            c.code,
            c.brand,
            c.benefit,
            c.url || video.url,
            creator.id,
            creator.name
          )
          totalCodes++
        }

        totalVideos++
      }
    } catch (err) {
      console.error(`  ❌ ${creator.name}:`, err.message)
    }
  }

  console.log(`\n✅ Sync terminé : ${totalVideos} vidéos, ${totalCodes} codes détectés`)
}

main().catch(console.error)
