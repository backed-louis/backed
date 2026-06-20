/**
 * Backed – Nettoyage des offres expirées (> 3 mois)
 * Usage: AIRTABLE_API_KEY=xxx node scripts/cleanup-expired-offers.js
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE = 'appzPhfC7ZdsjlPNa'
const TABLE = 'Offers'
const MONTHS = 3

function isExpired(createdTime) {
  const created = new Date(createdTime)
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - MONTHS)
  return created < cutoff
}

async function main() {
  if (!AIRTABLE_API_KEY) {
    console.error('❌ AIRTABLE_API_KEY requis')
    process.exit(1)
  }

  console.log(`🔄 Recherche des offres actives créées il y a plus de ${MONTHS} mois...`)

  const records = []
  let offset

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${TABLE}`)
    url.searchParams.set('filterByFormula', '{Status}="Active"')
    url.searchParams.set('fields[]', 'Status')
    url.searchParams.append('fields[]', 'Code')
    url.searchParams.append('fields[]', 'Slug')
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    })
    const data = await res.json()
    records.push(...data.records)
    offset = data.offset
  } while (offset)

  console.log(`📋 ${records.length} offres actives trouvées`)

  const expired = records.filter(r => isExpired(r.createdTime))
  console.log(`⏰ ${expired.length} offres expirées (> ${MONTHS} mois)\n`)

  if (expired.length === 0) {
    console.log('✅ Aucune offre à désactiver.')
    return
  }

  expired.forEach(r => {
    const code = r.fields['Code'] || 'sans code'
    const slug = r.fields['Slug'] || ''
    const created = new Date(r.createdTime).toLocaleDateString('fr-FR')
    console.log(`  ⚠️  ${slug} (${code}) — créée le ${created}`)
  })

  console.log('\nDésactivation en cours...')

  for (let i = 0; i < expired.length; i += 10) {
    const batch = expired.slice(i, i + 10)
    const payload = {
      records: batch.map(r => ({
        id: r.id,
        fields: { Status: 'Inactive' }
      }))
    }

    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${TABLE}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
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
      console.log(`  ✅ Désactivée : ${r.fields['Slug'] || r.id}`)
    })

    await new Promise(resolve => setTimeout(resolve, 200))
  }

  console.log(`\n🎉 ${expired.length} offres passées en Inactive.`)
}

main().catch(console.error)
