/**
 * Backed – Auto-fill Brand Slugs
 * Usage: AIRTABLE_KEY=xxx node scripts/fill-brand-slugs.mjs
 */

const AIRTABLE_KEY = process.env.AIRTABLE_KEY
const AIRTABLE_BASE = 'appzPhfC7ZdsjlPNa'
const TABLE = 'Brands'

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .trim()
    .replace(/\s+/g, '-')           // spaces to hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
}

async function main() {
  if (!AIRTABLE_KEY) {
    console.error('❌ AIRTABLE_KEY requis')
    process.exit(1)
  }

  // 1. Récupérer toutes les marques
  console.log('🔄 Récupération des marques...')
  const records = []
  let offset

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${TABLE}`)
    url.searchParams.set('fields[]', 'Name')
    url.searchParams.append('fields[]', 'Slug')
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_KEY}` }
    })
    const data = await res.json()
    records.push(...data.records)
    offset = data.offset
  } while (offset)

  console.log(`✅ ${records.length} marques trouvées\n`)

  // 2. Filtrer celles sans slug
  const toUpdate = records.filter(r => !r.fields['Slug'])
  console.log(`📝 ${toUpdate.length} marques sans slug à remplir\n`)

  if (toUpdate.length === 0) {
    console.log('✅ Tous les slugs sont déjà remplis !')
    return
  }

  // 3. Mettre à jour par batch de 10 (limite Airtable)
  for (let i = 0; i < toUpdate.length; i += 10) {
    const batch = toUpdate.slice(i, i + 10)
    const payload = {
      records: batch.map(r => ({
        id: r.id,
        fields: { Slug: toSlug(r.fields['Name']) }
      }))
    }

    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${TABLE}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`❌ Erreur batch ${i}: ${err}`)
      continue
    }

    batch.forEach(r => {
      console.log(`  ✅ ${r.fields['Name']} → ${toSlug(r.fields['Name'])}`)
    })

    // Pause pour éviter rate limit
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  console.log('\n🎉 Slugs remplis avec succès !')
}

main().catch(console.error)
