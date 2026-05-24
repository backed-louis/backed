const BASE_ID = process.env.AIRTABLE_BASE_ID
const API_KEY = process.env.AIRTABLE_API_KEY
const API_URL = `https://api.airtable.com/v0/${BASE_ID}`

async function fetchTable(table: string, params: Record<string, string> = {}, noCache = false) {
  const allRecords: any[] = []
  let offset: string | undefined

  do {
    const url = new URL(`${API_URL}/${encodeURIComponent(table)}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      ...(noCache ? { cache: 'no-store' } : { next: { revalidate: 3600 } }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Airtable [${table}] ${res.status}: ${err}`)
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

  const brandsMap: Record<string, { name: string; description: string; logo: string | null; website: string | null; category: string }> = {}
  brandsRaw.records.forEach((r: any) => {
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
      description: r.fields['Description'] || '',
      logo,
      website: website || null,
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
  const brand = brandsMap[brandId] ?? { name: '', description: '', logo: null, website: null, category: '' }

  return {
    id: r.id,
    brand: brand.name,
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
  }
}

export async function getFeaturedOffers(): Promise<Offer[]> {
  const { brandsMap, creatorsMap } = await buildMaps()

  const offersRaw = await fetchTable('Offers', {
    filterByFormula: 'AND({Status}="Active", {Homepage Position}>=1)',
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
    filterByFormula: '{Status}="Active"',
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
    slug: r.fields['Slug'] || '',
    platforms: r.fields['Platforms'] || [],
    channelId: r.fields['Channel ID'] || '',
    avatar: r.fields['Avatar'] || null,
  }))
}
