import { NextRequest, NextResponse } from 'next/server'

// Formulaire « Référence ton code » (/rejoindre) : chaque demande est enregistrée dans la table
// Airtable « Creator Requests », avec le statut « Nouveau ». Rien n'est publié automatiquement.

const BASE_ID = process.env.AIRTABLE_BASE_ID
const API_KEY = process.env.AIRTABLE_API_KEY
const TABLE = 'Creator Requests'

// Doit rester identique aux choix du champ « Platforms » dans Airtable et au formulaire.
const PLATEFORMES = ['YouTube', 'Instagram', 'TikTok', 'Twitch', 'Facebook', 'Autre']

// Limite grossière anti-spam : 5 demandes par heure et par adresse IP (mémoire de l'instance serveur,
// donc best effort ; le champ piège et les contrôles ci-dessous font le reste).
const FENETRE_MS = 60 * 60 * 1000
const MAX_PAR_FENETRE = 5
const essais = new Map<string, number[]>()

function trop(ip: string) {
  const now = Date.now()
  const recents = (essais.get(ip) || []).filter((t) => now - t < FENETRE_MS)
  recents.push(now)
  essais.set(ip, recents)
  if (essais.size > 5000) essais.clear()
  return recents.length > MAX_PAR_FENETRE
}

// Texte nettoyé : sans caractères de contrôle, espaces rognés, longueur bornée.
function texte(valeur: unknown, max: number) {
  if (typeof valeur !== 'string') return ''
  return valeur.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  // Champ piège (invisible pour une personne) : un robot le remplit. On répond « ok » sans rien enregistrer.
  if (texte(body.website, 200)) return NextResponse.json({ ok: true })

  const nom = texte(body.nom, 120)
  const email = texte(body.email, 200)
  const profil = texte(body.profil, 300)
  const marque = texte(body.marque, 120)
  const code = texte(body.code, 80)
  const conditions = texte(body.conditions, 1500)
  const justificatif = texte(body.justificatif, 500)
  const message = texte(body.message, 2000)
  const plateformes = Array.isArray(body.plateformes)
    ? Array.from(new Set(body.plateformes.filter((p): p is string => typeof p === 'string' && PLATEFORMES.includes(p))))
    : []

  if (!nom || !profil || !marque || !code) {
    return NextResponse.json({ error: 'Merci de remplir tous les champs obligatoires.' }, { status: 400 })
  }
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 })
  }
  if (plateformes.length === 0) {
    return NextResponse.json({ error: 'Choisis au moins une plateforme.' }, { status: 400 })
  }
  if (body.consentement !== true) {
    return NextResponse.json({ error: 'Le consentement est nécessaire pour traiter ta demande.' }, { status: 400 })
  }
  if (!BASE_ID || !API_KEY) {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 500 })
  }

  // Seules les demandes valides comptent dans la limite : une faute de frappe ne bloque personne.
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'inconnue'
  if (trop(ip)) {
    return NextResponse.json({ error: 'Trop de demandes. Réessaie un peu plus tard.' }, { status: 429 })
  }

  try {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Name: nom,
              Email: email,
              Platforms: plateformes,
              Profile: profil,
              Brand: marque,
              Code: code,
              Conditions: conditions,
              Proof: justificatif,
              Message: message,
              Status: 'Nouveau',
              'Created time': new Date().toISOString(),
            },
          },
        ],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Impossible d’enregistrer ta demande pour le moment.' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Impossible d’enregistrer ta demande pour le moment.' }, { status: 502 })
  }
}
