'use client'
// Décor de saison sur tout le site : citrouilles, fantômes et chauves-souris à Halloween,
// neige, guirlande, cadeaux, lutin et traîneau du Père Noël à Noël, etc.
// Couche fixe qui ne capte aucun clic ; animations coupées si l'appareil demande moins de mouvement.
import { useEffect, useMemo, useState } from 'react'
import { useSaisons } from '@/components/Saison'
import { Bat, Elf, Ghost, Gifts, PriceTag, Pumpkin, Ribbon, Sleigh, Spider, SpiderWeb } from '@/components/saisons/art'

const CSS = `
.sd { position: fixed; pointer-events: none; z-index: 90; }
.sd-flap { animation: sd-flap .32s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.sd-flicker { animation: sd-flicker 2.6s ease-in-out infinite; }
.sd-nose { animation: sd-blink 1.1s ease-in-out infinite; }
@keyframes sd-float { 0%,100% { transform: translateY(0) rotate(-5deg) } 50% { transform: translateY(-22px) rotate(5deg) } }
@keyframes sd-fly { 0% { transform: translate(-140px, 0) } 25% { transform: translate(25vw, -34px) } 50% { transform: translate(50vw, 12px) } 75% { transform: translate(75vw, -26px) } 100% { transform: translate(calc(100vw + 140px), 0) } }
@keyframes sd-flap { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.3) } }
@keyframes sd-flicker { 0%,100% { opacity: 1 } 40% { opacity: .7 } 48% { opacity: 1 } 70% { opacity: .6 } }
@keyframes sd-blink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
@keyframes sd-dangle { 0%,100% { transform: translateY(0) } 50% { transform: translateY(52px) } }
@keyframes sd-snow { from { transform: translate3d(0, -12vh, 0) } to { transform: translate3d(var(--dx), 112vh, 0) } }
@keyframes sd-twinkle { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
@keyframes sd-sleigh { 0% { transform: translate(-380px, 0) } 45% { transform: translate(calc(100vw + 40px), -28px) } 45.01%,100% { transform: translate(calc(100vw + 420px), -28px) } }
@keyframes sd-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes sd-peek { 0%,55%,100% { transform: translateY(105%) } 65%,90% { transform: translateY(12%) } }
@keyframes sd-rise { 0% { transform: translateY(0) rotate(-10deg); opacity: 0 } 12%,88% { opacity: .75 } 100% { transform: translateY(-115vh) rotate(18deg); opacity: 0 } }
@keyframes sd-swing { 0%,100% { transform: rotate(-9deg) } 50% { transform: rotate(9deg) } }
@keyframes sd-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@media (max-width: 640px) {
  .sd-desktop { display: none !important }
  .sd-corner { transform: scale(.68) }
  .sd-web { transform: scale(.6); transform-origin: top right }
  .sd-spider { right: 34px !important }
}
@media (prefers-reduced-motion: reduce) { .sd, .sd * { animation: none !important } .sd-moving { display: none !important } }
`

// Tirage pseudo-aléatoire stable (même décor d'un rendu à l'autre).
function rand(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function useLargeur() {
  const [w, setW] = useState(1280)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

// ─── Halloween ────────────────────────────────────────────────────────────────

function Halloween() {
  return (
    <>
      {/* toile d'araignée et araignée qui descend */}
      <div className="sd sd-web" style={{ top: 60, right: 0 }}><SpiderWeb size={150} /></div>
      <div className="sd sd-spider" style={{ top: 60, right: 62, animation: 'sd-dangle 6s ease-in-out infinite' }}>
        <div style={{ width: 1, height: 40, background: 'rgba(244,242,238,.35)', margin: '0 auto' }} />
        <Spider size={24} />
      </div>
      {/* fantômes */}
      <div className="sd sd-desktop" style={{ top: '26%', left: '2%', animation: 'sd-float 5s ease-in-out infinite' }}><Ghost size={64} /></div>
      <div className="sd" style={{ top: '58%', right: '2.5%', animation: 'sd-float 6.5s ease-in-out -2s infinite' }}><Ghost size={52} /></div>
      <div className="sd sd-desktop" style={{ top: '44%', left: '7%', opacity: .7, animation: 'sd-float 7s ease-in-out -4s infinite' }}><Ghost size={38} /></div>
      <div className="sd" style={{ top: '76%', left: '1%', opacity: .85, animation: 'sd-float 5.5s ease-in-out -1s infinite' }}><Ghost size={40} /></div>
      {/* chauves-souris */}
      {[{ top: '18%', d: 15, delay: 0, s: 56 }, { top: '34%', d: 19, delay: -7, s: 40 }, { top: '70%', d: 23, delay: -14, s: 48 }].map((b, i) => (
        <div key={i} className={`sd sd-moving${i === 2 ? ' sd-desktop' : ''}`} style={{ top: b.top, left: 0, animation: `sd-fly ${b.d}s linear ${b.delay}s infinite` }}>
          <Bat size={b.s} />
        </div>
      ))}
      {/* citrouilles dans les coins */}
      <div className="sd sd-corner" style={{ bottom: -10, left: 8, transformOrigin: 'bottom left', display: 'flex', alignItems: 'flex-end' }}>
        <Pumpkin size={104} />
        <Pumpkin size={66} style={{ marginLeft: -18 }} />
      </div>
      <div className="sd sd-corner" style={{ bottom: -8, right: 10, transformOrigin: 'bottom right' }}><Pumpkin size={86} /></div>
    </>
  )
}

// ─── Noël ─────────────────────────────────────────────────────────────────────

const BULBES = ['#E53935', '#FFC94D', '#2E9E4F', '#B266FF', '#4FC3F7']

function Guirlande() {
  const w = useLargeur()
  const seg = 120
  const n = Math.ceil(w / seg) + 1
  const y = (x: number) => { const t = (x % seg) / seg; return 4 + 56 * t * (1 - t) }
  let d = 'M0 4'
  for (let k = 0; k < n; k++) d += ` Q${k * seg + seg / 2} 32 ${(k + 1) * seg} 4`
  const bulbes = []
  for (let k = 0; k < n; k++) for (const t of [0.22, 0.5, 0.78]) bulbes.push(k * seg + t * seg)
  return (
    <div className="sd" style={{ top: 58, left: 0, right: 0, height: 34, zIndex: 101 }}>
      <svg width={w} height={34} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <path d={d} stroke="#2B3A2E" strokeWidth="2" fill="none" />
      </svg>
      {bulbes.map((x, i) => (
        <span key={i} style={{
          position: 'absolute', left: x - 4, top: y(x) - 1, width: 8, height: 12, borderRadius: '50% 50% 45% 45%',
          background: BULBES[i % BULBES.length], color: BULBES[i % BULBES.length],
          boxShadow: `0 0 10px 2px ${BULBES[i % BULBES.length]}`,
          animation: `sd-twinkle ${1.4 + (i % 3) * 0.5}s ease-in-out ${-(i % 5) * 0.37}s infinite`,
        }} />
      ))}
    </div>
  )
}

function Neige() {
  const w = useLargeur()
  const flocons = useMemo(() => {
    const r = rand(7)
    return Array.from({ length: w < 640 ? 26 : 55 }, () => ({
      left: r() * 100, size: 2 + r() * 5, op: 0.45 + r() * 0.5,
      dur: 9 + r() * 12, delay: -r() * 20, dx: `${Math.round(-50 + r() * 100)}px`, blur: r() > 0.7,
    }))
  }, [w])
  return (
    <div className="sd sd-moving" style={{ inset: 0, overflow: 'hidden' }}>
      {flocons.map((f, i) => (
        <span key={i} style={{
          position: 'absolute', top: 0, left: `${f.left}%`, width: f.size, height: f.size, borderRadius: '50%',
          background: '#fff', opacity: f.op, filter: f.blur ? 'blur(1px)' : undefined,
          ['--dx' as string]: f.dx, animation: `sd-snow ${f.dur}s linear ${f.delay}s infinite`,
        }} />
      ))}
    </div>
  )
}

function Noel() {
  return (
    <>
      <Neige />
      <Guirlande />
      {/* le traîneau du Père Noël traverse le ciel */}
      <div className="sd sd-moving" style={{ top: 104, left: 0, animation: 'sd-sleigh 34s linear 2s infinite' }}>
        <div style={{ animation: 'sd-bob 1.6s ease-in-out infinite' }}><Sleigh size={300} /></div>
      </div>
      {/* cadeaux et lutin */}
      <div className="sd sd-corner" style={{ bottom: -4, left: 10, transformOrigin: 'bottom left' }}><Gifts size={140} /></div>
      <div className="sd sd-corner" style={{ bottom: 0, right: 26, width: 90, height: 84, overflow: 'hidden', transformOrigin: 'bottom right' }}>
        <div style={{ animation: 'sd-peek 10s ease-in-out 3s infinite', transform: 'translateY(105%)' }}><Elf size={88} /></div>
      </div>
    </>
  )
}

// ─── Octobre rose ─────────────────────────────────────────────────────────────

function OctobreRose() {
  const rubans = useMemo(() => {
    const r = rand(11)
    return Array.from({ length: 9 }, (_, i) => ({
      left: i % 2 ? 90 + r() * 8 : 1 + r() * 8, size: 24 + r() * 18,
      dur: 16 + r() * 10, delay: -r() * 24, desktop: i > 3,
    }))
  }, [])
  return (
    <>
      {rubans.map((b, i) => (
        <div key={i} className={`sd sd-moving${b.desktop ? ' sd-desktop' : ''}`}
          style={{ bottom: -50, left: `${b.left}%`, animation: `sd-rise ${b.dur}s linear ${b.delay}s infinite` }}>
          <Ribbon size={b.size} />
        </div>
      ))}
    </>
  )
}

// ─── Black Friday ─────────────────────────────────────────────────────────────

function BlackFriday() {
  const texte = 'BLACK FRIDAY ✦ VÉRIFIE LE CODE DE TON CRÉATEUR AVANT DE PAYER ✦ '
  return (
    <>
      <div className="sd" style={{ top: 64, left: 0, right: 0, height: 30, zIndex: 99, background: '#000', borderBottom: '1px solid rgba(255,255,255,.14)', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'sd-marquee 26s linear infinite' }}>
          {[0, 1].map((k) => (
            <span key={k} style={{ fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 13, letterSpacing: '.08em', color: '#F4F2EE', paddingRight: 8 }}>
              {texte.repeat(6)}
            </span>
          ))}
        </div>
      </div>
      {[{ left: '3%', label: '-20%', d: 3.2 }, { right: '4%', label: '-50%', d: 2.7 }, { left: '10%', label: '-%', d: 3.8 }].map((t, i) => (
        <div key={i} className="sd sd-desktop" style={{ top: 94, left: t.left, right: t.right, transformOrigin: 'top center', animation: `sd-swing ${t.d}s ease-in-out ${-i}s infinite` }}>
          <PriceTag size={44} label={t.label} />
        </div>
      ))}
    </>
  )
}

export default function SaisonDecor() {
  const s = useSaisons()[0]
  if (!s) return null
  return (
    <div aria-hidden>
      <style>{CSS}</style>
      {s.id === 'halloween' && <Halloween />}
      {s.id === 'noel' && <Noel />}
      {s.id === 'octobre-rose' && <OctobreRose />}
      {s.id === 'black-friday' && <BlackFriday />}
    </div>
  )
}
