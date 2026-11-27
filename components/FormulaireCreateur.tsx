'use client'
import { useState } from 'react'
import Link from 'next/link'

// Doit rester identique à la liste de la route /api/rejoindre et aux choix du champ « Platforms » dans Airtable.
const PLATEFORMES = ['YouTube', 'Instagram', 'TikTok', 'Twitch', 'Facebook', 'Autre']

type Etat = 'repos' | 'envoi' | 'ok'

export default function FormulaireCreateur() {
  const [plateformes, setPlateformes] = useState<string[]>([])
  const [consentement, setConsentement] = useState(false)
  const [etat, setEtat] = useState<Etat>('repos')
  const [erreur, setErreur] = useState('')

  const basculer = (p: string) =>
    setPlateformes((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (etat === 'envoi') return
    setErreur('')
    if (plateformes.length === 0) {
      setErreur('Choisis au moins une plateforme.')
      return
    }
    const f = new FormData(e.currentTarget)
    const val = (k: string) => String(f.get(k) || '')
    setEtat('envoi')
    try {
      const res = await fetch('/api/rejoindre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: val('nom'),
          email: val('email'),
          plateformes,
          profil: val('profil'),
          marque: val('marque'),
          code: val('code'),
          conditions: val('conditions'),
          justificatif: val('justificatif'),
          message: val('message'),
          consentement,
          website: val('website'),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Une erreur est survenue. Réessaie dans un instant.')
      }
      setEtat('ok')
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Une erreur est survenue. Réessaie dans un instant.')
      setEtat('repos')
    }
  }

  if (etat === 'ok') {
    return (
      <div style={{ padding: 28, borderRadius: 'var(--r-xl)', background: 'var(--bg-card)', border: '1px solid var(--accent-border)' }}>
        <div style={{ fontFamily: 'var(--font-syne)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Merci, ta demande est bien reçue
        </div>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>
          On la vérifie et on revient vers toi par e-mail. Rien n’est publié sur Backed avant ton accord.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={envoyer} noValidate={false} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <style>{`
        .rj-champ { width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-md);
          padding: 12px 14px; font: inherit; font-size: 16px; color: var(--text-1); transition: border-color .15s; }
        .rj-champ::placeholder { color: var(--text-4); }
        .rj-champ:focus { outline: none; border-color: var(--accent); }
        .rj-puce { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 999px; font-size: 14px; font-weight: 600;
          background: var(--bg-card); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; user-select: none; transition: border-color .15s, background .15s, color .15s; }
        .rj-puce:hover { border-color: var(--border-hover); }
        .rj-puce-on { background: var(--accent-subtle); border-color: var(--accent); color: var(--text-1); }
        .rj-puce input { position: absolute; opacity: 0; pointer-events: none; }
        .rj-puce:focus-within { border-color: var(--accent); }
      `}</style>

      <Champ label="Nom ou pseudo" requis>
        <input className="rj-champ" name="nom" required maxLength={120} autoComplete="name" placeholder="Ton nom de créateur" />
      </Champ>

      <Champ label="E-mail" requis aide="Uniquement pour te répondre.">
        <input className="rj-champ" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="toi@exemple.fr" />
      </Champ>

      <Champ label="Où publies-tu du contenu ?" requis aide="Plusieurs choix possibles.">
        <div role="group" aria-label="Plateformes" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PLATEFORMES.map((p) => {
            const on = plateformes.includes(p)
            return (
              <label key={p} className={`rj-puce${on ? ' rj-puce-on' : ''}`} style={{ position: 'relative' }}>
                <input type="checkbox" checked={on} onChange={() => basculer(p)} />
                {on ? '✓ ' : ''}
                {p}
              </label>
            )
          })}
        </div>
      </Champ>

      <Champ label="Lien ou @ de ton compte principal" requis>
        <input className="rj-champ" name="profil" required maxLength={300} placeholder="youtube.com/@toi ou @toi" />
      </Champ>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 22 }}>
        <Champ label="Marque" requis>
          <input className="rj-champ" name="marque" required maxLength={120} placeholder="Ex. CurrentBody" />
        </Champ>
        <Champ label="Ton code promo" requis>
          <input className="rj-champ" name="code" required maxLength={80} autoCapitalize="characters" placeholder="Ex. TONCODE" />
        </Champ>
      </div>

      <Champ label="Conditions de l’offre" aide="Réduction, produits concernés, minimum d’achat, dates de début et de fin.">
        <textarea className="rj-champ" name="conditions" rows={3} maxLength={1500} style={{ resize: 'vertical' }} placeholder="Ex. 10 % sur tout le site, 20 % jusqu’au 6 décembre" />
      </Champ>

      <Champ label="Justificatif" aide="Un lien vers un post, une story ou une vidéo où figure ton code, ou un mail de la marque. Ça accélère la validation.">
        <input className="rj-champ" name="justificatif" maxLength={500} placeholder="Lien ou précisions" />
      </Champ>

      <Champ label="Message">
        <textarea className="rj-champ" name="message" rows={3} maxLength={2000} style={{ resize: 'vertical' }} />
      </Champ>

      {/* Champ piège : invisible pour une personne, les robots le remplissent. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Ne pas remplir
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, cursor: 'pointer' }}>
        <input
          type="checkbox"
          required
          checked={consentement}
          onChange={(e) => setConsentement(e.target.checked)}
          style={{ marginTop: 3, accentColor: 'var(--accent)' }}
        />
        <span>
          J’accepte que ces informations soient utilisées pour traiter ma demande de référencement. Voir la{' '}
          <Link href="/confidentialite" style={{ color: 'var(--accent-text)', textDecoration: 'underline' }}>
            politique de confidentialité
          </Link>
          .
        </span>
      </label>

      {erreur && (
        <div role="alert" style={{ fontSize: 14, color: '#FF6B6B', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
          {erreur}
        </div>
      )}

      <div>
        <button type="submit" className="btn-primary" disabled={etat === 'envoi'} style={{ opacity: etat === 'envoi' ? 0.7 : 1 }}>
          {etat === 'envoi' ? 'Envoi…' : 'Envoyer ma demande'}
        </button>
      </div>
    </form>
  )
}

function Champ({ label, requis, aide, children }: { label: string; requis?: boolean; aide?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: aide ? 2 : 8 }}>
        {label}
        {requis && <span style={{ color: 'var(--accent-text)' }}> *</span>}
      </div>
      {aide && <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.5 }}>{aide}</div>}
      {children}
    </div>
  )
}
