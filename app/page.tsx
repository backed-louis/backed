import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import FeaturedOffers from '@/components/FeaturedOffers'
import Categories from '@/components/Categories'
import HowItWorks from '@/components/HowItWorks'
import EmailAlert from '@/components/EmailAlert'
import Footer from '@/components/Footer'
import { getAllOffers } from '@/lib/airtable'

export const revalidate = 3600

export default async function HomePage() {
  const allOffers = await getAllOffers()

  const offerCounts: Record<string, number> = {}
  allOffers.forEach(offer => {
    if (offer.category) {
      offerCounts[offer.category] = (offerCounts[offer.category] || 0) + 1
    }
  })

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <FeaturedOffers />
        <Categories offerCounts={offerCounts} />
        <HowItWorks />
        <EmailAlert />
      </main>
      <Footer />
    </>
  )
}