const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

async function main() {
  console.log('🔍 Recherche des marques sans Website...')

  const records = await base('Brands').select({ fields: ['Name', 'Website'] }).all()

  const missing = records.filter(r => !r.fields['Website'])

  if (missing.length === 0) {
    console.log('✅ Toutes les marques ont un Website !')
    return
  }

  console.log(`\n⚠️  ${missing.length} marques sans Website :`)
  missing.forEach(r => console.log(`  - ${r.fields['Name']} (${r.id})`))
}

main().catch(console.error)