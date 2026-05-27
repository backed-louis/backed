import { MetadataRoute } from 'next'
import { getAllCreators, getCategories, getAllBrands } from '@/lib/airtable'

const BASE_URL = 'https://www.backed.fr'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [creators, categories, brands] = await Promise.all([
    getAllCreators(),
    getCategories(),
    getAllBrands(),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/explorer`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/createurs`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/cgu`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/confidentialite`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ]

  const creatorRoutes: MetadataRoute.Sitemap = creators
    .filter(c => c.slug)
    .map(creator => ({
      url: `${BASE_URL}/createur/${creator.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter(c => c.slug)
    .map(category => ({
      url: `${BASE_URL}/categorie/${category.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  const brandRoutes: MetadataRoute.Sitemap = brands
    .filter(b => b.slug)
    .map(brand => ({
      url: `${BASE_URL}/marque/${brand.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

  return [...staticRoutes, ...creatorRoutes, ...categoryRoutes, ...brandRoutes]
}
