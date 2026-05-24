const Airtable = require('airtable')
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID)
base('Creators').select({fields: ['Name', 'Channel ID']}).all().then(records => {
  records.forEach(r => {
    const id = r.fields['Channel ID']
    const valid = id && id.startsWith('UC') && id.length >= 20
    if (!valid) console.log('INVALIDE:', r.fields['Name'], '|', JSON.stringify(id))
  })
  console.log('Total:', records.length)
}).catch(console.error)
