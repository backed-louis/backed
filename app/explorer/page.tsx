import { getAllOffers, getCategories } from '@/lib/airtable'
import ExplorerClient from '@/components/ExplorerClient'
import Navbar from '@/components/Navbar'

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