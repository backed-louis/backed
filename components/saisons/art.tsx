// Illustrations de saison dessinées pour Backed (SVG maison, aucun visuel externe).
import type { CSSProperties } from 'react'

type P = { size?: number; style?: CSSProperties; className?: string }

// ─── Halloween ────────────────────────────────────────────────────────────────

export function WitchHat({ size = 30, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={style} className={className} aria-hidden>
      <path d="M33 4c3 1 5 3 6 6 1 2 1 5 3 8l9 26H13l11-22c2-4 3-8 2-12-2 1-4 1-5 0 4-1 8-4 12-6z" fill="#8B00FF" />
      <path d="M17 38h30l2 5H15z" fill="#FF8A1F" />
      <rect x="28" y="37.2" width="8" height="6" rx="1" fill="none" stroke="#FFC94D" strokeWidth="1.8" />
      <ellipse cx="32" cy="46" rx="29" ry="6.5" fill="#6A00C4" />
    </svg>
  )
}

export function Pumpkin({ size = 90, style, className, glow = true }: P & { glow?: boolean }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 100 90" style={style} className={className} aria-hidden>
      <path d="M50 18c-4 0-7 1-10 3-4-3-10-4-16-2C12 23 4 36 4 52c0 18 12 34 28 34 5 0 9-1 12-3 2 1 4 1 6 1s4 0 6-1c3 2 7 3 12 3 16 0 28-16 28-34 0-16-8-29-20-33-6-2-12-1-16 2-3-2-6-3-10-3z" fill="#FF8A1F" />
      <path d="M50 21c-7 10-7 54 0 63M50 21c7 10 7 54 0 63M31 22c-10 9-13 42 1 61M69 22c10 9 13 42-1 61" stroke="#D96400" strokeWidth="2.4" fill="none" opacity=".55" />
      <path d="M47 21c0-7 2-12 7-17l5 3c-4 4-6 8-6 14z" fill="#3E7A3A" />
      {glow && (
        <g fill="#FFE27A" className="sd-flicker">
          <path d="M27 45l9-12 9 12zM55 45l9-12 9 12zM46 55l4-6 4 6z" />
          <path d="M25 60l8 6 6-5 6 6 5-6 5 6 6-6 6 5 8-6c-3 12-14 16-25 16s-22-4-25-16z" />
        </g>
      )}
    </svg>
  )
}

export function Ghost({ size = 70, style, className }: P) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 60 70" style={style} className={className} aria-hidden>
      <path d="M30 2C14 2 6 14 6 30v34l8-6 8 6 8-6 8 6 8-6 8 6V30C54 14 46 2 30 2z" fill="#F4F2EE" opacity=".92" />
      <path d="M6 34c-4 1-6 4-5 8 2-2 4-3 6-3M54 34c4 1 6 4 5 8-2-2-4-3-6-3" fill="#F4F2EE" opacity=".92" />
      <ellipse cx="22" cy="28" rx="4" ry="5.5" fill="#1A1430" />
      <ellipse cx="38" cy="28" rx="4" ry="5.5" fill="#1A1430" />
      <ellipse cx="30" cy="41" rx="3.5" ry="4.5" fill="#1A1430" />
      <circle cx="16" cy="35" r="3" fill="#FF8FB8" opacity=".55" />
      <circle cx="44" cy="35" r="3" fill="#FF8FB8" opacity=".55" />
    </svg>
  )
}

export function Bat({ size = 60, style, className }: P) {
  return (
    <svg width={size} height={size / 2} viewBox="0 0 80 40" style={style} className={className} aria-hidden>
      <path className="sd-flap" style={{ transformOrigin: '40px 18px' }}
        d="M40 14c-1.5-3-3.5-5-3.5-5s-1 3 0 6c-6-1-10 0-12 4C20.5 13 12.5 9 2.5 11c6 3 8 8 8 14 4-2 8-2 10 2 2-4 6-5 10-3 2 4 6 6 9.5 6s7.5-2 9.5-6c4-2 8-1 10 3 2-4 6-4 10-2 0-6 2-11 8-14-10-2-18 2-22 8-2-4-6-5-12-4 1-3 0-6 0-6s-2 2-3.5 5z"
        fill="#5B3F8C" stroke="#B266FF" strokeWidth="1" />
      <circle cx="37.5" cy="17" r="1.1" fill="#FFE27A" />
      <circle cx="42.5" cy="17" r="1.1" fill="#FFE27A" />
    </svg>
  )
}

export function SpiderWeb({ size = 150, style, className }: P) {
  const rays = [0, 15, 30, 45, 60, 75, 90]
  const arcs = [28, 52, 78, 104, 130]
  const pt = (a: number, d: number) => {
    const r = (a * Math.PI) / 180
    return `${(150 - d * Math.cos(r)).toFixed(1)} ${(d * Math.sin(r)).toFixed(1)}`
  }
  return (
    <svg width={size} height={size} viewBox="0 0 150 150" style={style} className={className} aria-hidden>
      <g stroke="rgba(244,242,238,.3)" strokeWidth="1" fill="none">
        {rays.map((a) => <path key={a} d={`M150 0L${pt(a, 150)}`} />)}
        {arcs.map((d) => (
          <path key={d} d={`M${pt(rays[0], d)}` + rays.slice(1).map((a, i) => ` Q${pt((rays[i] + a) / 2, d - 7)} ${pt(a, d)}`).join('')} />
        ))}
      </g>
    </svg>
  )
}

export function Spider({ size = 22, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} className={className} aria-hidden>
      <g stroke="#B266FF" strokeWidth="1.3" fill="none" strokeLinecap="round">
        <path d="M8 11 3 8M8 13 2 13M8 15 3 19M16 11l5-3M16 13h6M16 15l5 4" />
      </g>
      <ellipse cx="12" cy="13" rx="4.5" ry="5" fill="#2A1D44" stroke="#B266FF" strokeWidth="1" />
      <circle cx="10.5" cy="11.5" r=".9" fill="#FFE27A" />
      <circle cx="13.5" cy="11.5" r=".9" fill="#FFE27A" />
    </svg>
  )
}

// ─── Noël ─────────────────────────────────────────────────────────────────────

export function SantaHat({ size = 30, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={style} className={className} aria-hidden>
      <path d="M9 45C12 28 22 13 39 11c9-1 15 4 17 13-6-4-12-3-15 3-3 5-4 12-4 18z" fill="#E53935" />
      <path d="M39 11c-6 2-11 8-14 16" stroke="#B71C1C" strokeWidth="2" fill="none" opacity=".5" />
      <circle cx="56" cy="27" r="6.5" fill="#FFFFFF" />
      <rect x="4" y="41" width="40" height="11" rx="5.5" fill="#FFFFFF" />
    </svg>
  )
}

export function Gifts({ size = 130, style, className }: P) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 130 104" style={style} className={className} aria-hidden>
      {/* grand cadeau violet */}
      <rect x="4" y="44" width="62" height="58" rx="4" fill="#8B00FF" />
      <rect x="30" y="44" width="10" height="58" fill="#FFC94D" />
      <rect x="0" y="36" width="70" height="14" rx="3" fill="#A020FF" />
      <rect x="30" y="36" width="10" height="14" fill="#FFC94D" />
      <path d="M35 36c-8-14-22-14-20-4 1 5 10 5 20 4zm0 0c8-14 22-14 20-4-1 5-10 5-20 4z" fill="#FFC94D" />
      {/* cadeau rouge */}
      <rect x="70" y="60" width="46" height="42" rx="4" fill="#E53935" />
      <rect x="88" y="60" width="9" height="42" fill="#FFFFFF" />
      <rect x="67" y="53" width="52" height="11" rx="3" fill="#F04A46" />
      <rect x="88" y="53" width="9" height="11" fill="#FFFFFF" />
      <path d="M92.5 53c-6-10-17-10-15-3 1 4 8 4 15 3zm0 0c6-10 17-10 15-3-1 4-8 4-15 3z" fill="#FFFFFF" />
      {/* petit cadeau doré */}
      <rect x="104" y="80" width="24" height="22" rx="3" fill="#FFC94D" />
      <rect x="113" y="80" width="6" height="22" fill="#8B00FF" />
    </svg>
  )
}

export function Elf({ size = 80, style, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" style={style} className={className} aria-hidden>
      {/* bonnet */}
      <path d="M18 34C22 18 34 6 52 4c-4 6-4 12 0 16l6 14z" fill="#2E9E4F" />
      <circle cx="52" cy="4" r="4" fill="#FFC94D" />
      <rect x="14" y="30" width="48" height="9" rx="4.5" fill="#E53935" />
      {/* oreilles */}
      <path d="M16 46c-8-2-13-8-14-14 6 1 11 4 15 8zM64 46c8-2 13-8 14-14-6 1-11 4-15 8z" fill="#F2C9A0" />
      {/* visage */}
      <ellipse cx="40" cy="52" rx="24" ry="22" fill="#F7D3AE" />
      <circle cx="31" cy="49" r="3" fill="#1A1430" />
      <circle cx="49" cy="49" r="3" fill="#1A1430" />
      <circle cx="32" cy="48" r="1" fill="#fff" />
      <circle cx="50" cy="48" r="1" fill="#fff" />
      <circle cx="25" cy="58" r="4" fill="#FF8FA0" opacity=".6" />
      <circle cx="55" cy="58" r="4" fill="#FF8FA0" opacity=".6" />
      <path d="M33 60c4 5 10 5 14 0" stroke="#1A1430" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Reindeer({ x, nose }: { x: number; nose?: boolean }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <ellipse cx="28" cy="34" rx="15" ry="7" fill="#FFC94D" />
      <path d="M39 30l7-12 5 2-6 12z" fill="#FFC94D" />
      <ellipse cx="50" cy="17" rx="6" ry="4" fill="#FFC94D" transform="rotate(-15 50 17)" />
      <g stroke="#FFC94D" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M47 13l-4-8m2 4-4-1M49 12l1-9m0 4 3-3" />
        <path d="M38 38l10 5M36 39l8 9M18 38l-12 1M20 39l-9 8" strokeWidth="2.6" />
        <path d="M13 31l-4-3" />
      </g>
      {nose && <circle cx="56" cy="18" r="2.6" fill="#FF3B30" className="sd-nose" />}
    </g>
  )
}

export function Sleigh({ size = 320, style, className }: P) {
  return (
    <svg width={size} height={size / 4} viewBox="0 0 320 80" style={style} className={className} aria-hidden>
      <path d="M76 38L150 50M126 36 150 50M176 36l-26 14" stroke="#FFC94D" strokeWidth="1.2" opacity=".7" />
      <Reindeer x={190} nose />
      <Reindeer x={130} />
      <Reindeer x={70} />
      {/* traîneau */}
      <g transform="translate(0 6)">
        <path d="M6 58h50c6 0 9-3 10-7" stroke="#FFC94D" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M12 54l2-18c1-6 5-8 10-8h20c6 0 10 3 12 8l6 10c2 4 0 8-5 8z" fill="#E53935" />
        <path d="M14 40h40" stroke="#FFC94D" strokeWidth="2" />
        {/* Père Noël */}
        <circle cx="34" cy="17" r="7" fill="#F7D3AE" />
        <path d="M26 30c0-6 4-9 8-9s8 3 8 9z" fill="#E53935" />
        <path d="M28 19c1 7 11 7 12 0-2 4-10 4-12 0z" fill="#FFFFFF" />
        <path d="M27 14c2-8 12-10 16-3l4 2-4 1c-3-3-10-3-16 0z" fill="#E53935" />
        <circle cx="47" cy="13" r="2.2" fill="#FFFFFF" />
        {/* hotte */}
        <path d="M14 30c-2-8 2-14 8-14 4 0 6 4 5 14z" fill="#8B5A2B" />
      </g>
    </svg>
  )
}

// ─── Octobre rose / Black Friday ─────────────────────────────────────────────

export function Ribbon({ size = 40, style, className, color = '#FF5FA2' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} className={className} aria-hidden>
      <path d="M8.6 21 15.9 9.6C17 7.8 16.6 5.4 14.9 4.2a4.6 4.6 0 0 0-5.8 0C7.4 5.4 7 7.8 8.1 9.6L15.4 21" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PriceTag({ size = 54, label = '-%', style, className }: P & { label?: string }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 40 60" style={style} className={className} aria-hidden>
      <line x1="20" y1="0" x2="20" y2="16" stroke="rgba(244,242,238,.5)" strokeWidth="1" />
      <path d="M8 22l12-8 12 8v32a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="#F4F2EE" />
      <circle cx="20" cy="21" r="2.2" fill="#07080F" />
      <text x="20" y="44" textAnchor="middle" fontFamily="var(--font-syne), sans-serif" fontWeight="800" fontSize="12" fill="#07080F">{label}</text>
    </svg>
  )
}
