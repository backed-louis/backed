import type { SaisonId } from '@/lib/saisons'

// Icônes dessinées pour Backed (aucun visuel externe).
export default function SaisonIcon({ id, color, size = 18 }: { id: SaisonId; color: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const }
  switch (id) {
    case 'octobre-rose': // ruban
      return (
        <svg {...common} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.6 21 15.9 9.6C17 7.8 16.6 5.4 14.9 4.2a4.6 4.6 0 0 0-5.8 0C7.4 5.4 7 7.8 8.1 9.6L15.4 21" />
        </svg>
      )
    case 'halloween': // citrouille
      return (
        <svg {...common} fill={color}>
          <path d="M12 5.5c-1 0-1.9.3-2.6.8C8.6 5.9 7.7 5.7 6.8 5.9 3.9 6.4 2 9.6 2 13.4 2 17.5 4.4 21 7.6 21c1 0 1.9-.3 2.6-.8.6.3 1.2.4 1.8.4s1.2-.1 1.8-.4c.7.5 1.6.8 2.6.8 3.2 0 5.6-3.5 5.6-7.6 0-3.8-1.9-7-4.8-7.5-.9-.2-1.8 0-2.6.4-.7-.5-1.6-.8-2.6-.8Z" />
          <path d="M11.2 6.2c-.1-1.6.4-3 1.6-4.2l1.3 1.1c-.9.9-1.3 1.9-1.2 3.1Z" fill="#3E7A3A" />
        </svg>
      )
    case 'black-november':
    case 'black-friday': // étiquette de prix
      return (
        <svg {...common} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round">
          <path d="M3 12.6V4.5C3 3.7 3.7 3 4.5 3h8.1c.4 0 .8.2 1.1.4l7.4 7.4c.6.6.6 1.5 0 2.1l-8.1 8.1c-.6.6-1.5.6-2.1 0l-7.4-7.4c-.3-.3-.5-.7-.5-1Z" />
          <circle cx="8" cy="8" r="1.6" fill={color} stroke="none" />
        </svg>
      )
    case 'noel': // cadeau
      return (
        <svg {...common} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round">
          <rect x="3.5" y="9" width="17" height="11.5" rx="1.5" />
          <path d="M2.5 9h19M12 9v11.5" />
          <path d="M12 9c-1-2.6-2.6-4.4-4.2-4.4-1.2 0-2 .8-2 1.9C5.8 8.1 7.6 9 12 9Zm0 0c1-2.6 2.6-4.4 4.2-4.4 1.2 0 2 .8 2 1.9 0 1.6-1.8 2.5-6.2 2.5Z" />
        </svg>
      )
  }
}
