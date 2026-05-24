const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

function toSlug(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function deslug(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function getBrandInfoFromClaude(brandSlug, categories) {
  const brandName = deslug(brandSlug)
  const prompt = `Tu es un expert en marketing. Pour la marque "${brandName}", donne-moi en JSON uniquement (sans markdown) :
{
  "name": "Nom exact de la marque",
  "description": "Description courte en français (max 10 mots)",
  "website": "https://url-officielle.com",
  "category": "une de ces catégories exactement: ${categories.join(', ')}"
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const text = data.content[0].text.trim()
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function main() {
  console.log('🔍 Chargement des données...')

  const [brandsRaw, creatorsRaw, offersRaw, categoriesRaw] = await Promise.all([
    base('Brands').select({ fields: ['Name'] }).all(),
    base('Creators').select({ fields: ['Name'] }).all(),
    base('Offers').select({ fields: ['Slug', 'Brand', 'Creator'] }).all(),
    base('Categories').select({ fields: ['Name'] }).all(),
  ])

  const categories = categoriesRaw.map(r => r.fields['Name']).filter(Boolean)
  const categoriesMap = {}
  categoriesRaw.forEach(r => { if (r.fields['Name']) categoriesMap[r.fields['Name']] = r.id })

  const brandsBySlug = {}
  brandsRaw.forEach(r => {
    if (r.fields['Name']) brandsBySlug[toSlug(r.fields['Name'])] = r.id
  })

  const creatorSlugById = {}
  creatorsRaw.forEach(r => {
    if (r.fields['Name']) creatorSlugById[r.id] = toSlug(r.fields['Name'])
  })

  const offersMissingBrand = offersRaw.filter(r => !r.fields['Brand'] || r.fields['Brand'].length === 0)
  console.log(`⚠️  ${offersMissingBrand.length} offres sans brand\n`)

  let fixed = 0
  let skipped = 0

  for (const offer of offersMissingBrand) {
    const rawSlug = offer.fields['Slug'] || ''
    const normalizedSlug = toSlug(rawSlug) // ← normalisation des accents
    const creatorId = offer.fields['Creator']?.[0]
    const creatorSlug = creatorSlugById[creatorId] || ''

    const brandSlug = creatorSlug && normalizedSlug.endsWith(`-${creatorSlug}`)
      ? normalizedSlug.slice(0, -(creatorSlug.length + 1))
      : normalizedSlug

    if (!brandSlug || brandSlug === creatorSlug) {
      console.log(`  ⏭️  ${rawSlug} — slug invalide, ignoré`)
      skipped++
      continue
    }

    let brandId = brandsBySlug[brandSlug]

    if (!brandId) {
      console.log(`  🤖 Brand inconnue "${brandSlug}", interroge Claude...`)
      const info = await getBrandInfoFromClaude(brandSlug, categories)

      if (!info || !info.website) {
        console.log(`  ❌ Claude n'a pas pu identifier : "${brandSlug}"`)
        skipped++
        continue
      }

      const domain = new URL(info.website).hostname
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      const categoryId = categoriesMap[info.category]

      const fields = {
        'Name': info.name,
        'Description': info.description,
        'Website': info.website,
        'Logo': [{ url: faviconUrl }],
      }
      if (categoryId) fields['Category'] = [categoryId]

      const created = await base('Brands').create([{ fields }])
      brandId = created[0].id
      brandsBySlug[toSlug(info.name)] = brandId
      console.log(`  ✅ Brand créée : ${info.name} (${info.website})`)
    }

    await base('Offers').update(offer.id, { 'Brand': [brandId] })
    console.log(`  🔗 Offre liée : ${rawSlug}`)
    fixed++
  }

  console.log(`\n✅ Terminé : ${fixed} corrigées, ${skipped} ignorées`)
}

main().catch(console.error)