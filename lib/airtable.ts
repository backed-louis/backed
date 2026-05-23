const BASE_ID = process.env.AIRTABLE_BASE_ID
const API_KEY = process.env.AIRTABLE_API_KEY
const API_URL = `https://api.airtable.com/v0/${BASE_ID}`

async function fetchTable(table: string, params: Record<string, string> = {}) {
  const url = new URL(`${API_URL}/${encodeURIComponent(table)}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
    next: { revalidate: 3600 },
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

  const creators = data.records.map((r: any) => ({
    id: r.id,
    name: r.fields['Name'] || '',
    slug: r.fields['Slug'] || '',
    platforms: r.fields['Platforms'] || [],
    channelId: r.fields['Channel ID'] || '',
    avatar: null as string | null,
  }))

  // Batch fetch avatars YouTube en un seul appel
  const channelIds = creators.map((c: any) => c.channelId).filter(Boolean).join(',')
  if (channelIds) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?key=${process.env.YOUTUBE_API_KEY}&id=${channelIds}&part=snippet`,
        { next: { revalidate: 3600 } }
      )
      const json = await res.json()
      console.log('YouTube API response:', JSON.stringify(json).slice(0, 500))
      const avatarMap: Record<string, string> = {}
      json.items?.forEach((item: any) => {
        avatarMap[item.id] = item.snippet?.thumbnails?.high?.url
          || item.snippet?.thumbnails?.default?.url
          || ''
      })
      creators.forEach((c: any) => {
        if (avatarMap[c.channelId]) c.avatar = avatarMap[c.channelId]
      })
    } catch (e) {
      console.error('YouTube avatar fetch error:', e)
    }
  }

  return creators
}
