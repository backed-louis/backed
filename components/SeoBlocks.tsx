import Link from 'next/link'
import type { Offer, PastOffer } from '@/lib/airtable'
import { dateCourte } from '@/lib/seo'

// Blocs de contenu des pages marques et créateurs : tableau des codes, anciens codes, FAQ.
// Rendus côté serveur, en texte : c'est ce que Google lit et peut reprendre dans ses résultats.

export type FaqItem = { q: string; a: string; html?: React.ReactNode }

export function faqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  }
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  }
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

export function SeoTitle({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return <h2 className={`seo-h2${first ? ' seo-h2-first' : ''}`}>{children}</h2>
}

type Col = 'brand' | 'creator'

// Tableau des codes actifs. `col` : la colonne qui renvoie vers l'autre page (le créateur sur une
// page marque, la marque sur une page créateur).
export function CodesTable({
  offers, col, creatorSlugs,
}: { offers: Offer[]; col: Col; creatorSlugs: Record<string, string> }) {
  return (
    <div className="seo-table-wrap">
      <table className="seo-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Avantage</th>
            <th>{col === 'creator' ? 'Créateur' : 'Marque'}</th>
            <th>Vu le</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => (
            <tr key={o.id}>
              <td className="seo-code">{o.code || <span className="seo-muted">Lien du créateur</span>}</td>
              <td>{o.benefit}</td>
              <td>
                {col === 'creator'
                  ? (creatorSlugs[o.creator]
                    ? <Link href={`/createur/${creatorSlugs[o.creator]}`}>{o.creator}</Link>
                    : o.creator)
                  : <Link href={`/marque/${o.brandSlug}`}>{o.brand}</Link>}
              </td>
              <td className="seo-date">{dateCourte(o.seen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Anciens codes : en texte barré, sans bouton copier.
export function PastCodesTable({
  past, col, creatorSlugs, activeBrands,
}: { past: PastOffer[]; col: Col; creatorSlugs: Record<string, string>; activeBrands: Set<string> }) {
  return (
    <div className="seo-table-wrap">
      <table className="seo-table seo-table-past">
        <thead>
          <tr>
            <th>Ancien code</th>
            <th>Avantage</th>
            <th>{col === 'creator' ? 'Créateur' : 'Marque'}</th>
            <th>Vu le</th>
          </tr>
        </thead>
        <tbody>
          {past.map((p) => (
            <tr key={`${p.brandSlug}-${p.code}`}>
              <td className="seo-code"><s>{p.code}</s> <span className="seo-badge">Expiré</span></td>
              <td>{p.benefit}</td>
              <td>
                {col === 'creator'
                  ? (creatorSlugs[p.creator] ? <Link href={`/createur/${creatorSlugs[p.creator]}`}>{p.creator}</Link> : p.creator)
                  : (activeBrands.has(p.brandSlug) ? <Link href={`/marque/${p.brandSlug}`}>{p.brand}</Link> : p.brand)}
              </td>
              <td className="seo-date">{dateCourte(p.seen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="seo-faq">
      {items.map((i) => (
        <div key={i.q}>
          <h3>{i.q}</h3>
          <p>{i.html ?? i.a}</p>
        </div>
      ))}
    </div>
  )
}

// Liens vers d'autres pages (marques de la même catégorie, autres créateurs) : ils aident Google
// à découvrir et relier les pages du site.
export function LinkChips({ links }: { links: { href: string; label: string; sub?: string }[] }) {
  return (
    <div className="seo-chips">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="seo-chip">
          <span>{l.label}</span>
          {l.sub && <span className="seo-chip-sub">{l.sub}</span>}
        </Link>
      ))}
    </div>
  )
}
