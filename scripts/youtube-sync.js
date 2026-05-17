async function main() {
  console.log('🚀 Démarrage sync YouTube → Airtable')
  const creators = await getCreators()
  console.log(`📋 ${creators.length} créateurs trouvés`)

  let totalVideos = 0
  let totalCodes = 0

  for (const creator of creators) {
    console.log(`\n👤 ${creator.name}`)
    try {
      const videos = await getRecentVideos(creator.channelId)

      for (const video of videos) {
        const exists = await videoExists(video.videoId)
        if (exists) continue

        const description = await getVideoDescription(video.videoId)
        const codes = detectCodes(description)

        console.log(`  📹 ${video.title} → ${codes.length} code(s) : ${codes.join(', ') || 'aucun'}`)
        console.log(`  🔑 Creator ID: ${creator.id}`)

        await base('Videos Inbox').create([{
          fields: {
            'Video ID': video.videoId,
            'Video URL': video.url,
            'Title': video.title,
            'Description': description.slice(0, 5000),
            'Published At': video.publishedAt,
            'Creator': [creator.id],
            'Detected Codes (raw)': codes.join(', '),
            'Processed': false,
          }
        }])

        totalVideos++
        totalCodes += codes.length
      }
    } catch (err) {
      console.error(`  ❌ ${creator.name}:`, JSON.stringify(err, null, 2))
    }
  }

  console.log(`\n✅ Sync terminé : ${totalVideos} vidéos, ${totalCodes} codes détectés`)
}