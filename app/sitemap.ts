import { MetadataRoute } from 'next'
import { getAllCreators, getCategories, getAllOffers } from '@/lib/airtable'

const BASE_URL = 'https://www.backed.fr'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [creators, categories, offers] = await Promise.all([
    getAllCreators(),
    getCategories(),
    getAllOffers(),
  ])

  // Pages statiques
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/explorer`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/createurs`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/cgu`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/confidentialite`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ]

  // Pages créateurs
  const creatorRoutes: MetadataRoute.Sitemap = creators
    .filter(c => c.slug)
    .map(creator => ({
      url: `${BASE_URL}/createur/${creator.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // Pages catégories
  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter(c => c.slug)
    .map(category => ({
      url: `${BASE_URL}/categorie/${category.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // Pages marques (slugs uniques extraits des offres)
  const brandSlugs = [...new Set(
    offers
      .filter(o => o.slug)
      .map(o => {
        // Le slug d'une offre est du type "marque-createur", on extrait la partie marque
        const parts = o.slug.split('-')
        return parts.slice(0, -1).join('-')
      })
      .filter(Boolean)
  )]

  const brandRoutes: MetadataRoute.Sitemap = brandSlugs.map(slug => ({
    url: `${BASE_URL}/marque/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...creatorRoutes, ...categoryRoutes, ...brandRoutes]
}
