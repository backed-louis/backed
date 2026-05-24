const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

function toSlug(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

async function main() {
  console.log('🔍 Chargement des créateurs...')
  const records = await base('Creators').select({ fields: ['Name', 'Slug'] }).all()

  let fixed = 0
  for (const r of records) {
    const name = r.fields['Name']
    if (!name) continue
    const expected = toSlug(name)
    const current = r.fields['Slug'] || ''
    if (current === expected) {
      console.log(`✅ ${name}`)
      continue
    }
    await base('Creators').update(r.id, { 'Slug': expected })
    console.log(`  🔧 ${name} : ${current} → ${expected}`)
    fixed++
  }

  console.log(`\n✅ Terminé : ${fixed} slugs corrigés`)
}

main().catch(console.error)