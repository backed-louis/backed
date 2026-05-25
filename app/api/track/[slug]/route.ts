import { NextRequest, NextResponse } from 'next/server'

const BASE_ID = process.env.AIRTABLE_BASE_ID
const API_KEY = process.env.AIRTABLE_API_KEY
const API_URL = `https://api.airtable.com/v0/${BASE_ID}`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    // Trouver l'offre par slug
    const searchRes = await fetch(
      `${API_URL}/Offers?filterByFormula={Slug}="${slug}"&maxRecords=1`,
      { headers: { Authorization: `Bearer ${API_KEY}` }, cache: 'no-store' }
    )
    const searchData = await searchRes.json()
    const record = searchData.records?.[0]

    if (!record) {
      return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })
    }

    const currentClicks = record.fields['Clicks'] || 0
    const sourceUrl = record.fields['Source URL'] || ''

    // Incrémenter le compteur
    await fetch(`${API_URL}/Offers/${record.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
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
