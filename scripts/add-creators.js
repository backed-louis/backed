/**
 * Backed – Ajouter des créateurs YouTube
 * Usage: AIRTABLE_API_KEY=xxx YOUTUBE_API_KEY=xxx node scripts/add-creators.js "@Michou, @Domingo, Pierre Croce"
 *
 * Pour chaque @pseudo YouTube (ou nom de chaîne) : retrouve la chaîne, puis crée le créateur
 * dans Airtable (nom, Channel ID, slug, avatar). Les chaînes déjà présentes sont ignorées.
 * La synchro YouTube de la nuit récupère ensuite leurs codes promo.
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const BASE = process.env.AIRTABLE_BASE_ID || 'appzPhfC7ZdsjlPNa'
const MIN_SUBSCRIBERS = Number(process.env.MIN_SUBSCRIBERS || 40000)
const SUMMARY = process.env.GITHUB_STEP_SUMMARY

const slugify = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

async function yt(path) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}&key=${YOUTUBE_API_KEY}`)
  const data = await res.json()
  if (data.error) throw new Error(`YouTube ${data.error.code}: ${data.error.message}`)
  return data
}

// @pseudo -> recherche exacte (1 unité de quota) ; nom -> recherche de chaîne (100 unités).
async function findChannel(input) {
  const q = input.trim()
  if (q.startsWith('@')) {
    const data = await yt(`channels?part=snippet,statistics&forHandle=${encodeURIComponent(q)}`)
    return data.items?.[0] || null
  }
  const search = await yt(`search?part=snippet&type=channel&maxResults=1&regionCode=FR&relevanceLanguage=fr&q=${encodeURIComponent(q)}`)
  const id = search.items?.[0]?.snippet?.channelId
  if (!id) return null
  const data = await yt(`channels?part=snippet,statistics&id=${id}`)
  return data.items?.[0] || null
}

async function airtable(path, init = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  const inputs = (process.argv[2] || process.env.CREATORS || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
  if (!AIRTABLE_API_KEY || !YOUTUBE_API_KEY || !inputs.length) {
    console.error('❌ AIRTABLE_API_KEY, YOUTUBE_API_KEY et une liste de créateurs sont requis')
    process.exit(1)
  }

  const existing = []
  let offset
  do {
    const data = await airtable(`Creators?fields[]=Name&fields[]=Channel%20ID&fields[]=Slug${offset ? `&offset=${offset}` : ''}`)
    existing.push(...data.records)
    offset = data.offset
  } while (offset)
  const knownIds = new Set(existing.map((r) => r.fields['Channel ID']).filter(Boolean))
  const knownSlugs = new Set(existing.map((r) => r.fields['Slug']).filter(Boolean))

  const lines = ['| Demandé | Résultat | Chaîne | Abonnés |', '| --- | --- | --- | --- |']
  let added = 0
  for (const input of inputs) {
    let status, channel
    try {
      channel = await findChannel(input)
      if (!channel) status = '❌ introuvable'
      else if (knownIds.has(channel.id)) status = '⏭️ déjà présent'
      else if (Number(channel.statistics?.subscriberCount || 0) < MIN_SUBSCRIBERS) status = `⏭️ moins de ${MIN_SUBSCRIBERS / 1000} k abonnés`
      else {
        const name = channel.snippet.title.trim()
        let slug = slugify(name)
        for (let i = 2; knownSlugs.has(slug); i++) slug = `${slugify(name)}-${i}`
        const t = channel.snippet.thumbnails || {}
        await airtable('Creators', {
          method: 'POST',
          body: JSON.stringify({
            records: [{ fields: { Name: name, 'Channel ID': channel.id, Slug: slug, Platforms: ['Youtube'], Avatar: (t.high || t.medium || t.default || {}).url } }],
            typecast: true,
          }),
        })
        knownIds.add(channel.id)
        knownSlugs.add(slug)
        added++
        status = '✅ ajouté'
      }
    } catch (err) {
      status = `❌ ${err.message}`
    }
    const title = channel ? `[${channel.snippet.title}](https://www.youtube.com/channel/${channel.id})` : '—'
    const subs = channel?.statistics?.subscriberCount ? Number(channel.statistics.subscriberCount).toLocaleString('fr-FR') : '—'
    console.log(`${status} — ${input} → ${channel ? channel.snippet.title : '—'} (${subs})`)
    lines.push(`| ${input} | ${status} | ${title} | ${subs} |`)
  }

  const summary = `## Créateurs ajoutés : ${added}\n\n${lines.join('\n')}\n`
  if (SUMMARY) require('fs').appendFileSync(SUMMARY, summary)
  console.log(`\n✅ ${added} créateur(s) ajouté(s)`)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
