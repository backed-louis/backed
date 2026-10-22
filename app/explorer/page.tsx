import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'
import { getAllOffers, getCategories } from '@/lib/airtable'
import ExplorerClient from '@/components/ExplorerClient'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: "Tous les codes promo des créateurs YouTube | Backed",
  description: "Tous les codes promo partagés par les créateurs YouTube, par marque et par catégorie. Gratuit, sans compte.",
  alternates: { canonical: `${SITE_URL}/explorer` },
  openGraph: { title: "Tous les codes promo des créateurs YouTube | Backed", description: "Tous les codes promo partagés par les créateurs YouTube, par marque et par catégorie. Gratuit, sans compte.", url: `${SITE_URL}/explorer` },
}


export const revalidate = 3600

export default async function ExplorerPage() {
  const [offers, categories] = await Promise.all([
    getAllOffers(),
    getCategories(),
  ])

  return (
    <>
      <Navbar />
      <ExplorerClient offers={offers} categories={categories} />
    </>
  )
}