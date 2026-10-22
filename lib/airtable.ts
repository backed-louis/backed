import { unstable_cache } from 'next/cache'

const BASE_ID = process.env.AIRTABLE_BASE_ID
const API_KEY = process.env.AIRTABLE_API_KEY
const API_URL = `https://api.airtable.com/v0/${BASE_ID}`

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Airtable accepte 5 requêtes par seconde et par base. Au-delà, il répond 429 et
// bloque la base pendant 30 secondes : toutes les pages rendues à ce moment-là
// tombaient en erreur (« This page couldn't load »). On espace donc les requêtes
// d'au moins 250 ms (4 par seconde), et en cas de 429 on attend la fin du blocage.
let nextSlot = 0
async function waitTurn() {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + 250
  if (at > now) await sleep(at - now)
}

const RETRY_429 = [5000, 10000, 20000] // 35 s au total : couvre le blocage de 30 s
const RETRY_5XX = [1000, 2000, 4000]

async function fetchTable(table: string, params: Record<string, string> = {}) {
  const allRecords: any[] = []
  let offset: string | undefined

  do {
    const url = new URL(`${API_URL}/${encodeURIComponent(table)}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    if (offset) url.searchParams.set('offset', offset)

    let res: Response | undefined
    for (let attempt = 0; ; attempt++) {
      await waitTurn()
      let failure: unknown = null
      try {
        // Pas de cache par requête ici : c'est le jeu de données entier qui est mis
        // en cache (voir loadData), une seule fois pour tout le site.
        // Le signal neuf à chaque essai empêche Next de « mémoriser » la requête :
        // sans lui, chaque nouvel essai renvoyait la même réponse 429 sans rappeler Airtable.
        res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${API_KEY}` },
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        })
      } catch (err) {
        failure = err // réseau coupé ou Airtable trop lent : on réessaie comme une erreur serveur
      }
      const status = failure ? 0 : res!.status
      const delays = status === 429 ? RETRY_429 : status === 0 || status >= 500 ? RETRY_5XX : []
      if (attempt >= delays.length) {
        if (failure) throw failure
        break
      }
      await sleep(delays[attempt])
    }

    if (!res || !res.ok) {
      const err = res ? await res.text() : ''
      throw new Error(`Airtable [${table}] ${res?.status}: ${err}`)
    }

    const data = await res.json()
    allRecords.push(...(data.records || []))
    offset = data.offset
  } while (offset)

  return { records: allRecords }
}

export interface Offer {
  id: string
  brand: string
  brandSlug: string
  brandDescription: string
  brandLogo: string | null
  brandWebsite: string | null
  creator: string
  category: string
  code: string
  benefit: string
  type: string
  homepagePosition: number | null
  sourceUrl: string
  slug: string
  clicks: number
  endDate: string | null
}

export interface Category {
  id: string
  name: string
  slug: string
  priority: number
  offerCount: number
}

export interface Creator {
  id: string
  name: string
  slug: string
  platforms: string[]
  channelId: string
  avatar: string | null
}

export interface Brand {
  id: string
  name: string
  slug: string
}

// ─── Données Airtable, mises en cache une fois pour tout le site ─────────────

type RawData = { offers: any[]; brands: any[]; creators: any[]; categories: any[] }

type MapsResult = {
  brandsMap: Record<string, { name: string; slug: string; description: string; logo: string | null; website: string | null; category: string }>
  creatorsMap: Record<string, string>
  categoriesMap: Record<string, string>
  categoriesList: Category[]
}

// Filtre Airtable : offre active ET non expirée (End Date vide ou >= aujourd'hui)
const ACTIVE_NOT_EXPIRED =
  'AND({Status}="Active", OR({End Date}="", IS_AFTER({End Date}, DATEADD(TODAY(), -1, \'days\'))))'

async function fetchAll(): Promise<RawData> {
  // Requêtes l'une après l'autre (et espacées par waitTurn) pour rester sous la limite.
  const offers = (await fetchTable('Offers', { filterByFormula: ACTIVE_NOT_EXPIRED })).records
  const brands = (await fetchTable('Brands')).records
  const creators = (await fetchTable('Creators')).records
  const categories = (await fetchTable('Categories')).records
  return { offers, brands, creators, categories }
}

// Une seule entrée de cache partagée par toutes les pages et toutes les fonctions
// Vercel, renouvelée au plus une fois par heure (comme l'ISR du site). Tant que le
// renouvellement échoue, Next continue de servir la dernière version réussie.
const cachedFetchAll = unstable_cache(fetchAll, ['airtable-data-v1'], { revalidate: 3600, tags: ['airtable'] })

// En plus, dans chaque instance : une seule lecture en cours à la fois, et la
// dernière lecture réussie en secours si Airtable ne répond pas.
let inflight: Promise<RawData> | null = null
let lastGood: RawData | null = null
let lastFailure: { at: number; err: unknown } | null = null

async function loadData(): Promise<RawData> {
  if (!inflight) {
    // Échec il y a moins de 30 s et rien en secours : inutile de refaire 35 s d'essais
    // dans la même page (métadonnées puis contenu), on affiche tout de suite l'erreur.
    if (!lastGood && lastFailure && Date.now() - lastFailure.at < 30_000) throw lastFailure.err
    inflight = cachedFetchAll()
      .then((d) => {
        lastFailure = null
        return (lastGood = d)
      })
      .catch((err) => {
        if (lastGood) {
          console.error('Airtable indisponible, dernière version utilisée :', err)
          return lastGood
        }
        lastFailure = { at: Date.now(), err }
        throw err
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

function buildMapsFrom(data: RawData): MapsResult {
  const categoriesMap: Record<string, string> = {}
  const categoriesList: Category[] = []

  data.categories.forEach((r: any) => {
    categoriesMap[r.id] = r.fields['Name'] || ''
    categoriesList.push({
      id: r.id,
      name: r.fields['Name'] || '',
      slug: r.fields['Slug'] || '',
      priority: r.fields['Priority'] || 0,
      offerCount: 0,
    })
  })

  const brandsMap: MapsResult['brandsMap'] = {}
  data.brands.forEach((r: any) => {
    const categoryId = r.fields['Category']?.[0]
    const website = r.fields['Website'] || ''

    let logo: string | null = null
    if (website) {
      try {
        const domain = new URL(website).hostname
        logo = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      } catch {}
    }

    brandsMap[r.id] = {
      name: r.fields['Name'] || '',
      slug: r.fields['slug'] || '',
      description: r.fields['Description'] || '',
      logo,
      website: website || null,
      category: categoriesMap[categoryId] || '',
    }
  })

  const creatorsMap: Record<string, string> = {}
  data.creators.forEach((r: any) => {
    creatorsMap[r.id] = r.fields['Name'] || ''
  })

  return { brandsMap, creatorsMap, categoriesMap, categoriesList }
}

async function buildMaps(): Promise<MapsResult> {
  return buildMapsFrom(await loadData())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapOffer(r: any, brandsMap: any, creatorsMap: any): Offer {
  const brandId = r.fields['Brand']?.[0]
  const creatorId = r.fields['Creator']?.[0]
  const brand = brandsMap[brandId] ?? { name: '', slug: '', description: '', logo: null, website: null, category: '' }

  return {
    id: r.id,
    brand: brand.name,
    brandSlug: brand.slug,
    brandDescription: brand.description,
    brandLogo: brand.logo,
    brandWebsite: brand.website,
    creator: creatorsMap[creatorId] || '',
    category: brand.category,
    code: r.fields['Code'] || '',
    benefit: r.fields['Benefit'] || '',
    type: r.fields['Type'] || '',
    homepagePosition: r.fields['Homepage Position'] ?? null,
    sourceUrl: r.fields['Source URL'] || '',
    slug: r.fields['Slug'] || '',
    clicks: r.fields['Clicks'] || 0,
    endDate: r.fields['End Date'] || null,
  }
}

// Avantage concret et chiffré : « 20 € offerts », « -15 % », « 4 mois offerts », « 7 jours gratuits »…
const ADVANTAGE = /\d+([.,]\d+)?\s?(%|€|euros?\b|mois\b|jours?\b|ans?\b|go\b)|offert|gratuit|essai/i

// Offre « lien » : pas de code, mais un lien personnel du créateur (ex. get.revolut.com/…/SQueezie)
// avec un avantage chiffré. Les liens sans avantage, ou qui renvoient juste à la vidéo, restent masqués.
export function isLinkOffer(offer: Pick<Offer, 'code' | 'sourceUrl' | 'benefit'>): boolean {
  if (offer.code.trim()) return false
  let host = ''
  try {
    host = new URL(offer.sourceUrl).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return false
  }
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return false
  return ADVANTAGE.test(offer.benefit) && !/newsletter/i.test(offer.benefit)
}

// Garde-fou : une offre n'est affichée que si
// - elle a un code promo, ou un lien personnel du créateur avec un avantage chiffré ;
// - sa marque a une fiche complète (nom, slug, description, catégorie), pour que
//   chaque page marque soit propre (fiches complétées par scripts/complete-brands.js).
// Les offres dont la date de fin est passée sont déjà exclues par ACTIVE_NOT_EXPIRED.
function hasValidBrand(offer: Offer): boolean {
  return Boolean(
    (offer.code.trim() || isLinkOffer(offer)) &&
    offer.brand && offer.brandSlug &&
    offer.brandDescription?.trim() && offer.category
  )
}

// Garde-fou anti-doublons : une seule offre par (créateur, marque, code ou lien).
// On garde la plus récente (createdTime), et on conserve l'ordre d'origine des offres.
function dedupeRecords(records: any[]): any[] {
  const keyOf = (r: any) => {
    const creator = r.fields['Creator']?.[0] || ''
    const brand = r.fields['Brand']?.[0] || ''
    const code = String(r.fields['Code'] || '').trim().toLowerCase()
    const url = String(r.fields['Source URL'] || '').split('?')[0].toLowerCase().replace(/\/$/, '')
    return `${creator}|${brand}|${code || url || r.id}`
  }

  const newest = new Map<string, any>()
  for (const r of records) {
    const k = keyOf(r)
    const current = newest.get(k)
    if (!current || String(r.createdTime) > String(current.createdTime)) newest.set(k, r)
  }

  const keptIds = new Set(Array.from(newest.values()).map((r) => r.id))
  return records.filter((r) => keptIds.has(r.id))
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function getFeaturedOffers(): Promise<Offer[]> {
  const data = await loadData()
  const { brandsMap, creatorsMap } = buildMapsFrom(data)

  const positioned = data.offers
    .filter((r: any) => (r.fields['Homepage Position'] ?? 0) >= 1)
    .sort((a: any, b: any) => a.fields['Homepage Position'] - b.fields['Homepage Position'])
    .slice(0, 6)

  const curated = dedupeRecords(positioned)
    .map((r: any) => mapOffer(r, brandsMap, creatorsMap))
    .filter(hasValidBrand)
  if (curated.length >= 6) return curated

  // Complément automatique : les offres actives les plus cliquées, avec un code,
  // une seule par marque, pour que la section ne soit jamais vide.
  const usedBrands = new Set(curated.map((o) => o.brandSlug))
  const filler = (await getAllOffers())
    .filter((o) => o.code && !usedBrands.has(o.brandSlug))
    .sort((a, b) => b.clicks - a.clicks)
  const picked: Offer[] = []
  for (const o of filler) {
    if (curated.length + picked.length >= 6) break
    if (usedBrands.has(o.brandSlug)) continue
    usedBrands.add(o.brandSlug)
    picked.push(o)
  }
  return [...curated, ...picked]
}

export async function getCategories(): Promise<Category[]> {
  const { categoriesList } = await buildMaps()
  return categoriesList.sort((a, b) => a.priority - b.priority)
}

export async function getAllOffers(): Promise<Offer[]> {
  const data = await loadData()
  const { brandsMap, creatorsMap } = buildMapsFrom(data)

  return dedupeRecords(data.offers)
    .map((r: any) => mapOffer(r, brandsMap, creatorsMap))
    .filter(hasValidBrand)
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr')

export async function getAllCreators(): Promise<Creator[]> {
  const data = await loadData()

  return data.creators
    .map((r: any) => ({
      id: r.id,
      name: r.fields['Name'] || '',
      slug: r.fields['Slug'] || '',
      platforms: r.fields['Platforms'] || [],
      channelId: r.fields['Channel ID'] || '',
      avatar: r.fields['Avatar'] || null,
    }))
    .sort(byName)
}

export async function getAllBrands(): Promise<Brand[]> {
  const data = await loadData()

  return data.brands
    .map((r: any) => ({
      id: r.id,
      name: r.fields['Name'] || '',
      slug: r.fields['slug'] || '',
    }))
    .filter((b: Brand) => b.slug)
    .sort(byName)
}
