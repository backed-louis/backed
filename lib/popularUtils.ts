import { Offer } from '@/lib/airtable'

export function getPopularThreshold(offers: Offer[]): number {
  const clicks = offers.map(o => o.clicks || 0).filter(c => c > 0)
  if (clicks.length === 0) return Infinity
  const sorted = [...clicks].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * 0.9)
  return sorted[idx]
}

export function isPopularOffer(offer: Offer, threshold: number): boolean {
  return threshold < Infinity && (offer.clicks || 0) >= threshold
}
