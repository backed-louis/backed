const BASE_ID = process.env.AIRTABLE_BASE_ID
const API_KEY = process.env.AIRTABLE_API_KEY
const API_URL = `https://api.airtable.com/v0/${BASE_ID}`

async function fetchTable(table: string, params: Record<string, string> = {}) {
  const url = new URL(`${API_URL}/${encodeURIComponent(table)}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
    next: { revalidate: 3600 }, // 1h au lieu de 60s
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Airtable [${table}] ${res.status}: ${err}`)
  }
  return res.json()
}

export interface Offer {
  id: string
  brand: string
  brandDescription: string
  brandLogo: string | null
  creator: string
  category: string
  code: string
  benefit: string
  type: string
  homepagePosition: number | null
  sourceUrl: string
  slug: string
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
}

async function buildMaps() {
  const [brandsRaw, creatorsRaw, categoriesRaw] = await Promise.all([
    fetchTable('Brands'),
    fetchTable('Creators'),
    fetchTable('Categories'),
  ])

  const categoriesMap: Record<string, string> = {}
  const categoriesList: Category[] = []

  categoriesRaw.records.forEach((r: any) => {
    categoriesMap[r.id] = r.fields['Name'] || ''
    categoriesList.push({
      id: r.id,
      name: r.fields['Name'] || '',
      slug: r.fields['Slug'] || '',
      priority: r.fields['Priority'] || 0,
      offerCount: 0,
    })
  })

  const brandsMap: Record<string, { name: string; description: string; logo: string | null; category: string }> = {}
  brandsRaw.records.forEach((r: any) => {
    const categoryId = r.fields['Category']?.[0]
    brandsMap[r.id] = {
      name: r.fields['Name'] || '',
      description: r.fields['Description'] || '',
      logo: r.fields['Logo']?.[0]?.url || null,
      category: categoriesMap[categoryId] || '',
    }
  })

  const creatorsMap: Record<string, string> = {}
  creatorsRaw.records.forEach((r: any) => {
    creatorsMap[r.id] = r.fields['Name'] || ''
  })

  return { brandsMap, creatorsMap, categoriesMap, categoriesList }
}

function mapOffer(r: any, brandsMap: any, creatorsMap: any): Offer {
  const brandId = r.fields['Brand']?.[0]
  const creatorId = r.fields['Creator']?.[0]
  const brand = brandsMap[brandId] ?? { name: '', description: '', logo: null, category: '' }

  return {
    id: r.id,
    brand: brand.name,
    brandDescription: brand.description,
    brandLogo: brand.logo,
    creator: creatorsMap[creatorId] || '',
    category: brand.category,
    code: r.fields['Code'] || '',
    benefit: r.fields['Benefit'] || '',
    type: r.fields['Type'] || '',
    homepagePosition: r.fields['Homepage Position'] ?? null,
    sourceUrl: r.fields['Source URL'] || '',
    slug: r.fields['Slug'] || '',
  }
}

export async function getFeaturedOffers(): Promise<Offer[]> {
  const { brandsMap, creatorsMap } = await buildMaps()

  const offersRaw = await fetchTable('Offers', {
    filterByFormula: `AND({Status}="Active", {Homepage Position}>=1)`,
    'sort[0][field]': 'Homepage Position',
    'sort[0][direction]': 'asc',
    'maxRecords': '6',
  })

  return offersRaw.records.map((r: any) => mapOffer(r, brandsMap, creatorsMap))
}

export async function getCategories(): Promise<Category[]> {
  const { categoriesList } = await buildMaps()
  return categoriesList.sort((a, b) => a.priority - b.priority)
}

export async function getAllOffers(): Promise<Offer[]> {
  const { brandsMap, creatorsMap } = await buildMaps()

  const offersRaw = await fetchTable('Offers', {
    filterByFormula: `{Status}="Active"`,
  })

  return offersRaw.records.map((r: any) => mapOffer(r, brandsMap, creatorsMap))
}

export async function getAllCreators(): Promise<Creator[]> {
  const data = await fetchTable('Creators', {
    'sort[0][field]': 'Name',
    'sort[0][direction]': 'asc',
  })

  return data.records.map((r: any) => ({
    id: r.id,
    name: r.fields['Name'] || '',
    slug: (r.fields['Name'] || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    platforms: r.fields['Platforms'] || [],
    channelId: r.fields['Channel ID'] || '',
  }))
}