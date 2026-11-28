import { NextRequest, NextResponse, after } from 'next/server'

// Liens suivis : backed.fr/l/<source>/<page du site>
//   backed.fr/l/tiktok                 → accueil, compté pour « tiktok »
//   backed.fr/l/story/marque/nordvpn   → page NordVPN, compté pour « story »
// Vercel Analytics ne montre pas les paramètres UTM sur l'offre gratuite, et les applis
// (TikTok, Instagram) n'envoient souvent pas leur nom : ces liens disent enfin d'où viennent
// les visites. Un compteur par source dans la table Airtable « Liens suivis ».

const BASE_ID = process.env.AIRTABLE_BASE_ID
const API_KEY = process.env.AIRTABLE_API_KEY
const TABLE = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent('Liens suivis')}`
const headers = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }

// Robots d'aperçu des réseaux et moteurs : ils ouvrent le lien sans être des visiteurs.
const BOT = /bot|crawl|spider|preview|facebookexternalhit|meta-externalagent|bytespider|tiktok.*spider|whatsapp|telegram|slack|discord|embedly|curl|wget|python|headless/i

async function compter(source: string, destination: string) {
  const url = new URL(TABLE)
  url.searchParams.set('filterByFormula', `{Source}="${source}"`)
  url.searchParams.set('maxRecords', '1')
  const res = await fetch(url, { headers, cache: 'no-store' })
  const record = res.ok ? (await res.json()).records?.[0] : null
  const fields = { 'Dernier clic': new Date().toISOString(), 'Dernière destination': destination }
  if (record) {
    await fetch(`${TABLE}/${record.id}`, {
      method: 'PATCH', headers, cache: 'no-store',
      body: JSON.stringify({ fields: { ...fields, Clics: (record.fields['Clics'] || 0) + 1 } }),
    })
  } else {
    await fetch(TABLE, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ records: [{ fields: { ...fields, Source: source, Clics: 1 } }] }),
    })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ chemin: string[] }> }) {
  const { chemin } = await params
  const source = (chemin[0] || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
  // Seulement une page du site, jamais une adresse extérieure.
  const rest = chemin.slice(1).map((s) => s.toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean)
  const destination = `/${rest.join('/')}`

  const ua = request.headers.get('user-agent') || ''
  if (source && !BOT.test(ua)) {
    after(() => compter(source, destination).catch((err) => console.error('Lien suivi non compté :', err)))
  }

  const res = NextResponse.redirect(new URL(destination, request.url), 307)
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('X-Robots-Tag', 'noindex')
  return res
}
