import { NextRequest, NextResponse } from 'next/server'

const BASE_ID = process.env.AIRTABLE_BASE_ID
const API_KEY = process.env.AIRTABLE_API_KEY
const API_URL = `https://api.airtable.com/v0/${BASE_ID}`
const headers = { Authorization: `Bearer ${API_KEY}` }

// Le paramètre est l'identifiant Airtable de l'offre affichée (« rec… »). Plusieurs offres ont le
// même Slug (marque + créateur, ex. une ancienne offre inactive et la nouvelle) : chercher par slug
// comptait le clic sur la première trouvée, souvent la mauvaise. Le slug reste accepté pour les
// pages encore en cache, en privilégiant l'offre active la plus récente.
const RECORD_ID = /^rec[A-Za-z0-9]{14}$/

async function findOffer(param: string) {
  if (RECORD_ID.test(param)) {
    const res = await fetch(`${API_URL}/Offers/${param}`, { headers, cache: 'no-store' })
    return res.ok ? res.json() : null
  }
  const slug = param.replace(/["\\]/g, '')
  const url = new URL(`${API_URL}/Offers`)
  url.searchParams.set('filterByFormula', `{Slug}="${slug}"`)
  const res = await fetch(url, { headers, cache: 'no-store' })
  const records: any[] = res.ok ? (await res.json()).records || [] : []
  const score = (r: any) => `${r.fields['Status'] === 'Active' ? 1 : 0}${r.createdTime}`
  return records.sort((a, b) => score(b).localeCompare(score(a)))[0] || null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: param } = await params

  try {
    const record = await findOffer(param)
    if (!record) {
      return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })
    }

    const currentClicks = record.fields['Clicks'] || 0
    const sourceUrl = record.fields['Source URL'] || ''

    // Incrémenter le compteur
    await fetch(`${API_URL}/Offers/${record.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Clicks: currentClicks + 1 } }),
      cache: 'no-store',
    })

    // Rediriger vers la source
    if (sourceUrl) {
      return NextResponse.redirect(sourceUrl)
    }

    return NextResponse.json({ clicks: currentClicks + 1 })
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
