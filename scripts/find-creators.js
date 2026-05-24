const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

const CREATORS_TO_ADD = [
  { name: 'Hugo Décrypte', platforms: ['Youtube'] },
  { name: 'Yann Darwin', platforms: ['Youtube'] },
  { name: 'Gabriel Le Bomin', platforms: ['Youtube'] },
  { name: 'ZeratoR', platforms: ['Youtube', 'Twitch'] },
  { name: 'Inoxtag', platforms: ['Youtube', 'Twitch'] },
  { name: 'Locklear', platforms: ['Youtube', 'Twitch'] },
  { name: 'Kameto', platforms: ['Youtube', 'Twitch'] },
  { name: 'Ponce', platforms: ['Youtube', 'Twitch'] },
  { name: 'Léna Situations', platforms: ['Youtube'] },
  { name: 'Natoo', platforms: ['Youtube'] },
  { name: 'Weem', platforms: ['Youtube'] },
  { name: 'Pauline Palvadeau', platforms: ['Youtube'] },
  { name: 'Science Étonnante', platforms: ['Youtube'] },
  { name: 'Nota Bene', platforms: ['Youtube'] },
  { name: 'Etoiles', platforms: ['Youtube', 'Twitch'] },
  { name: 'Laink et Terracid', platforms: ['Youtube', 'Twitch'] },
  { name: 'Sardoche', platforms: ['Youtube', 'Twitch'] },
  { name: 'Xari', platforms: ['Youtube', 'Twitch'] },
  { name: 'Antoine Daniel', platforms: ['Youtube'] },
  { name: 'Joueur du Grenier', platforms: ['Youtube'] },
  { name: 'EnjoyPhoenix', platforms: ['Youtube'] },
  { name: 'Mister V', platforms: ['Youtube'] },
  { name: 'Norman', platforms: ['Youtube'] },
  { name: 'Cyrus North', platforms: ['Youtube'] },
  { name: 'Swan Slater', platforms: ['Youtube', 'Twitch'] },
  { name: 'FastGoodCuisine', platforms: ['Youtube'] },
  { name: 'Dirty Biology', platforms: ['Youtube'] },
  { name: 'Balade Mentale', platforms: ['Youtube'] },
  { name: 'Matthieu Louvet', platforms: ['Youtube'] },
  { name: 'Linksthesun', platforms: ['Youtube', 'Twitch'] },
]

function toSlug(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

async function searchYouTubeChannel(name) {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=${encodeURIComponent(name)}&type=channel&part=snippet&maxResults=1`
  const res = await fetch(url)
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null
  return {
    channelId: item.snippet.channelId,
    title: item.snippet.title,
  }
}

async function creatorExists(name) {
  const records = await base('Creators')
    .select({ filterByFormula: `{Name} = "${name}"`, maxRecords: 1 })
    .firstPage()
  return records.length > 0
}

async function main() {
  console.log('🚀 Recherche et ajout des créateurs...\n')

  let added = 0
  let skipped = 0
  let notFound = 0

  for (const creator of CREATORS_TO_ADD) {
    // Vérifier si déjà existant
    const exists = await creatorExists(creator.name)
    if (exists) {
      console.log(`⏭️  ${creator.name} — déjà présent`)
      skipped++
      continue
    }

    // Chercher sur YouTube
    const channel = await searchYouTubeChannel(creator.name)
    if (!channel) {
      console.log(`❌ ${creator.name} — introuvable sur YouTube`)
      notFound++
      continue
    }

    console.log(`  🔍 ${creator.name} → "${channel.title}" (${channel.channelId})`)

    // Ajouter dans Airtable
    await base('Creators').create([{
      fields: {
        'Name': creator.name,
        'Channel ID': channel.channelId,
        'Slug': toSlug(creator.name),
        'Platforms': creator.platforms,
      }
    }])

    console.log(`  ✅ ${creator.name} ajouté`)
    added++

    // Petite pause pour éviter le rate limiting
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n✅ Terminé : ${added} ajoutés, ${skipped} déjà présents, ${notFound} introuvables`)
}

main().catch(console.error)