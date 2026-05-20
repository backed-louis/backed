const Airtable = require('airtable')
const { URL } = require('url')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

async function main() {
  console.log('🚀 Upload logos...')
  const records = await base('Brands').select({ fields: ['Name', 'Website', 'Logo'] }).all()

  for (const record of records) {
    const name = record.fields['Name']
    const logo = record.fields['Logo']

    if (logo && logo.length > 0) {
      console.log(`⏭️  ${name} — logo déjà présent, skip`)
      continue
    }

    const website = record.fields['Website']
    if (!website) {
      console.log(`⚠️  ${name} — pas de website, skip`)
      continue
    }

    try {
      const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`

      await base('Brands').update(record.id, {
        'Logo': [{ url: faviconUrl }]
      })

      console.log(`✅ ${name} — logo uploadé`)
    } catch (err) {
      console.error(`❌ ${name}: ${err.message}`)
    }
  }

  console.log('\n✅ Terminé')
}

main().catch(console.error)