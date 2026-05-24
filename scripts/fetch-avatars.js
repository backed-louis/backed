const Airtable = require('airtable')
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

async function main() {
  console.log('Demarrage...')
  const records = await base('Creators').select({ fields: ['Name', 'Channel ID', 'Avatar'] }).all()
  console.log('Createurs:', records.length)

  for (const record of records) {
    const channelId = (record.fields['Channel ID'] || '').trim()
    const name = record.fields['Name']
    if (!channelId.startsWith('UC') || channelId.length < 20) {
      console.log('SKIP invalide:', name, channelId)
      continue
    }
    try {
      const res = await fetch('https://www.googleapis.com/youtube/v3/channels?key=' + YOUTUBE_API_KEY + '&id=' + channelId + '&part=snippet')
      const data = await res.json()
      if (data.error) { console.log('ERR', name, data.error.message); continue }
      const url = data.items?.[0]?.snippet?.thumbnails?.high?.url || data.items?.[0]?.snippet?.thumbnails?.default?.url
      if (!url) { console.log('NO URL', name); continue }
      await base('Creators').update(record.id, { 'Avatar': url })
      console.log('OK', name)
    } catch(e) { console.log('CATCH', name, e.message) }
    await new Promise(r => setTimeout(r, 200))
  }
  console.log('Termine')
}
main().ca