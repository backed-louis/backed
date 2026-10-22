'use client'
// Décor de saison sur tout le site (Halloween, Noël, Black Friday).
// Octobre rose n'a pas de décor : juste le ruban à côté du logo et la phrase sur l'accueil.
// Couche fixe qui ne capte aucun clic ; animations coupées si l'appareil demande moins de mouvement.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSaisons } from '@/components/Saison'
import {
  Bat, Bauble, CandyCane, Cat, ChristmasTree, DeadTree, Elf, Eyes, Ghost, Gifts, Moon, PriceTag,
  Pumpkin, ShoppingBag, Sleigh, Snowman, Spider, SpiderWeb, Tombstone, Witch,
} from '@/components/saisons/art'

const DECOREES = ['halloween', 'noel', 'black-friday']

// Petite toile pour le coin des cartes, et bonnet de neige pour le haut des cartes.
const WEB_CARD = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><g stroke="rgba(244,242,238,0.35)" fill="none" stroke-width="1"><path d="M60 0L0 0M60 0L10 25M60 0L30 45M60 0L50 58M60 0L60 60"/><path d="M48 0Q50 6 55 8Q56 13 60 14"/><path d="M34 0Q38 10 45 14Q46 22 52 26Q55 28 60 28"/><path d="M20 0Q26 14 36 20Q38 32 46 38Q52 40 60 42"/></g></svg>')}")`
const SNOW_CAP = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 20" preserveAspectRatio="none"><path d="M0 8C10 2 20 2 30 6S50 0 62 5S84 1 96 6S118 0 130 5S152 2 164 6S186 1 200 7V12C190 18 182 12 176 16S160 12 152 17S136 11 128 15S110 12 102 17S86 11 78 15S60 12 52 17S34 11 26 15S10 12 0 14Z" fill="white"/></svg>')}")`

const CSS = `
.sd { position: fixed; pointer-events: none; z-index: 90; }
.sd-flap { animation: sd-flap .32s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.sd-flicker { animation: sd-flicker 2.6s ease-in-out infinite; }
.sd-nose { animation: sd-blink 1.1s ease-in-out infinite; }
.sd-blinkeyes { animation: sd-eyes 4.5s ease-in-out infinite; }
@keyframes sd-float { 0%,100% { transform: translateY(0) rotate(-5deg) } 50% { transform: translateY(-22px) rotate(5deg) } }
@keyframes sd-drift { from { transform: translateX(-120px) } to { transform: translateX(calc(100vw + 120px)) } }
@keyframes sd-fly { 0% { transform: translate(-140px, 0) } 25% { transform: translate(25vw, -34px) } 50% { transform: translate(50vw, 12px) } 75% { transform: translate(75vw, -26px) } 100% { transform: translate(calc(100vw + 140px), 0) } }
@keyframes sd-flap { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.3) } }
@keyframes sd-flicker { 0%,100% { opacity: 1 } 40% { opacity: .7 } 48% { opacity: 1 } 70% { opacity: .6 } }
@keyframes sd-blink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
@keyframes sd-eyes { 0%,44%,52%,100% { transform: scaleY(1) } 48% { transform: scaleY(.1) } }
@keyframes sd-dangle { 0%,100% { transform: translateY(0) } 50% { transform: translateY(var(--dd, 52px)) } }
@keyframes sd-fall { from { transform: translate3d(0, -12vh, 0) rotate(0deg) } to { transform: translate3d(var(--dx), 112vh, 0) rotate(var(--rot, 0deg)) } }
@keyframes sd-twinkle { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
@keyframes sd-sleigh { 0% { transform: translate(-380px, 0) } 55% { transform: translate(calc(100vw + 40px), -28px) } 55.01%,100% { transform: translate(calc(100vw + 420px), -28px) } }
@keyframes sd-witch { 0% { transform: translate(-200px, 40px) rotate(-6deg) } 50% { transform: translate(calc(100vw + 60px), -30px) rotate(-10deg) } 50.01%,100% { transform: translate(calc(100vw + 300px), -30px) } }
@keyframes sd-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes sd-peek { 0%,55%,100% { transform: translateY(105%) } 65%,90% { transform: translateY(10%) } }
@keyframes sd-swing { 0%,100% { transform: rotate(-9deg) } 50% { transform: rotate(9deg) } }
@keyframes sd-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes sd-marquee-rev { from { transform: translateX(-50%) } to { transform: translateX(0) } }
@keyframes sd-fog { 0%,100% { transform: translateX(-6%) } 50% { transform: translateX(6%) } }
@keyframes sd-shoot { 0%,88% { transform: translate(0,0); opacity: 0 } 90% { opacity: 1 } 100% { transform: translate(-420px, 220px); opacity: 0 } }

/* sur les cartes */
html[data-saison="halloween"] .offer-card, html[data-saison="halloween"] .category-card { position: relative; }
html[data-saison="halloween"] .offer-card::after, html[data-saison="halloween"] .category-card::after {
  content: ''; position: absolute; top: 0; right: 0; width: 56px; height: 56px; pointer-events: none;
  background: ${WEB_CARD} no-repeat top right / contain; border-top-right-radius: inherit;
}
html[data-saison="noel"] .offer-card, html[data-saison="noel"] .category-card { position: relative; }
html[data-saison="noel"] .offer-card::before, html[data-saison="noel"] .category-card::before {
  content: ''; position: absolute; top: -7px; left: 10px; right: 10px; height: 16px; pointer-events: none;
  background: ${SNOW_CAP} no-repeat center / 100% 100%; filter: drop-shadow(0 2px 2px rgba(0,0,0,.25));
}
/* place pour la scène fixe en bas de l'écran */
html[data-saison="halloween"] body, html[data-saison="noel"] body { padding-bottom: 96px; }
html[data-saison="black-friday"] body { padding-bottom: 40px; }

@media (max-width: 640px) {
  .sd-desktop { display: none !important }
  .sd-scene { transform: scale(.6) }
  .sd-web { transform: scale(.6) }
  .sd-tag { transform: scale(.7) }
  html[data-saison="halloween"] body, html[data-saison="noel"] body { padding-bottom: 64px; }
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

// Fil qui pend sous le menu, avec des éléments accrochés (ampoules, fanions…).
function Fil({ couleur, children }: { couleur: string; children: (x: number, y: number, i: number) => ReactNode }) {
  const w = useLargeur()
  const seg = 120
  const n = Math.ceil(w / seg) + 1
  const y = (x: number) => { const t = (x % seg) / seg; return 4 + 56 * t * (1 - t) }
  let d = 'M0 4'
  for (let k = 0; k < n; k++) d += ` Q${k * seg + seg / 2} 32 ${(k + 1) * seg} 4`
  const pts: number[] = []
  for (let k = 0; k < n; k++) for (const t of [0.22, 0.5, 0.78]) pts.push(k * seg + t * seg)
  return (
    <div className="sd" style={{ top: 58, left: 0, right: 0, height: 40, zIndex: 101 }}>
      <svg width={w} height={34} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <path d={d} stroke={couleur} strokeWidth="2" fill="none" />
      </svg>
      {pts.map((x, i) => children(x, y(x), i))}
    </div>
  )
}

// Pluie d'éléments qui tombent (neige, étiquettes…).
function Chute({ n, nMobile, seed, render }: { n: number; nMobile: number; seed: number; render: (i: number, r: () => number) => ReactNode }) {
  const w = useLargeur()
  const items = useMemo(() => {
    const r = rand(seed)
    return Array.from({ length: w < 640 ? nMobile : n }, (_, i) => ({
      left: r() * 100, dur: 9 + r() * 12, delay: -r() * 20,
      dx: `${Math.round(-60 + r() * 120)}px`, rot: `${Math.round(-200 + r() * 400)}deg`, i, v: r(),
    }))
  }, [w, n, nMobile, seed])
  return (
    <div className="sd sd-moving" style={{ inset: 0, overflow: 'hidden' }}>
      {items.map((f) => (
        <span key={f.i} style={{
          position: 'absolute', top: 0, left: `${f.left}%`,
          ['--dx' as string]: f.dx, ['--rot' as string]: f.rot,
          animation: `sd-fall ${f.dur}s linear ${f.delay}s infinite`,
        }}>
          {render(f.i, () => f.v)}
        </span>
      ))}
    </div>
  )
}

// ─── Halloween ────────────────────────────────────────────────────────────────

const FANIONS = ['#FF8A1F', '#8B00FF', '#1A1430']

function Halloween() {
  return (
    <>
      {/* fanions sous le menu */}
      <Fil couleur="#3A2A5C">
        {(x, y, i) => (
          <svg key={i} width="22" height="26" viewBox="0 0 22 26" style={{ position: 'absolute', left: x - 11, top: y - 2 }} aria-hidden>
            <path d="M0 0h22L11 24z" fill={FANIONS[i % 3]} stroke={i % 3 === 2 ? '#B266FF' : 'none'} strokeWidth="1" />
            {i % 3 === 1 && <circle cx="11" cy="8" r="2.5" fill="#FF8A1F" />}
          </svg>
        )}
      </Fil>
      {/* toiles et araignées */}
      <div className="sd sd-web" style={{ top: 64, right: 0, transformOrigin: 'top right' }}><SpiderWeb size={170} /></div>
      <div className="sd sd-web sd-desktop" style={{ top: 64, left: 0, transform: 'scaleX(-1)' }}><SpiderWeb size={130} /></div>
      {[{ right: 70, h: 60, dd: '60px', d: 6 }, { left: '22%', h: 90, dd: '80px', d: 8, desktop: true }, { right: '28%', h: 40, dd: '50px', d: 7, desktop: true }].map((s, i) => (
        <div key={i} className={`sd${s.desktop ? ' sd-desktop' : ''}`} style={{ top: 70, left: s.left, right: s.right, ['--dd' as string]: s.dd, animation: `sd-dangle ${s.d}s ease-in-out ${-i * 2}s infinite` }}>
          <div style={{ width: 1, height: s.h, background: 'rgba(244,242,238,.35)', margin: '0 auto' }} />
          <Spider size={26} />
        </div>
      ))}
      {/* fantômes qui flottent */}
      {[
        { top: '24%', left: '2%', s: 66, d: 5, desktop: true }, { top: '58%', right: '2.5%', s: 54, d: 6.5 }, { top: '42%', left: '6.5%', s: 38, d: 7, o: .7, desktop: true },
        { top: '30%', right: '7%', s: 44, d: 5.8, o: .8, desktop: true }, { top: '74%', left: '1%', s: 42, d: 5.5, o: .85 },
      ].map((g, i) => (
        <div key={i} className={`sd${g.desktop ? ' sd-desktop' : ''}`} style={{ top: g.top, left: g.left, right: g.right, opacity: g.o, animation: `sd-float ${g.d}s ease-in-out ${-i * 1.3}s infinite` }}>
          <Ghost size={g.s} />
        </div>
      ))}
      {/* fantôme qui traverse */}
      <div className="sd sd-moving sd-desktop" style={{ top: '50%', left: 0, opacity: .55, animation: 'sd-drift 38s linear -12s infinite' }}>
        <div style={{ animation: 'sd-float 4s ease-in-out infinite' }}><Ghost size={46} /></div>
      </div>
      {/* chauves-souris */}
      {[
        { top: '16%', d: 13, s: 56 }, { top: '30%', d: 17, s: 40 }, { top: '46%', d: 21, s: 46, desktop: true }, { top: '62%', d: 15, s: 34, desktop: true },
        { top: '22%', d: 25, s: 30, desktop: true }, { top: '70%', d: 19, s: 50 }, { top: '38%', d: 11, s: 28, desktop: true }, { top: '54%', d: 27, s: 38, desktop: true },
      ].map((b, i) => (
        <div key={i} className={`sd sd-moving${b.desktop ? ' sd-desktop' : ''}`} style={{ top: b.top, left: 0, animation: `sd-fly ${b.d}s linear ${-i * 3.1}s infinite` }}>
          <Bat size={b.s} />
        </div>
      ))}
      {/* yeux dans le noir */}
      {[{ top: '36%', left: '1.5%' }, { top: '66%', right: '1.5%' }, { top: '20%', right: '3%' }, { top: '84%', left: '12%' }].map((e, i) => (
        <div key={i} className="sd sd-desktop" style={{ top: e.top, left: e.left, right: e.right, opacity: .85 }}>
          <div style={{ animation: `sd-blink ${5 + i}s ease-in-out ${-i}s infinite` }}><Eyes size={30} /></div>
        </div>
      ))}
      {/* scène du bas : brume, arbre mort, tombes, citrouilles, chat */}
      <div className="sd" style={{ bottom: 0, left: 0, right: 0, height: 120, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: -20, left: '-10%', right: '-10%', height: 70, background: 'radial-gradient(ellipse at center, rgba(178,102,255,.18), transparent 70%)', filter: 'blur(6px)', animation: 'sd-fog 14s ease-in-out infinite' }} />
        <svg width="100%" height="34" viewBox="0 0 1000 34" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0 }} aria-hidden>
          <path d="M0 20C120 6 220 26 360 14S620 4 760 16 920 8 1000 14V34H0z" fill="#120D1F" />
        </svg>
      </div>
      <div className="sd sd-scene" style={{ bottom: 0, left: 0, display: 'flex', alignItems: 'flex-end', transformOrigin: 'bottom left' }}>
        <DeadTree size={170} style={{ marginRight: -40 }} />
        <Tombstone size={64} lines={['R.I.P.', 'PRIX', 'FORT']} style={{ marginBottom: 6 }} />
        <Pumpkin size={96} style={{ marginLeft: -6 }} />
        <Pumpkin size={58} style={{ marginLeft: -14 }} />
      </div>
      <div className="sd sd-desktop" style={{ bottom: 4, left: '38%', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <Pumpkin size={52} />
        <Tombstone size={46} lines={['RIP']} />
        <Pumpkin size={40} glow={false} />
      </div>
      <div className="sd sd-scene" style={{ bottom: 0, right: 0, display: 'flex', alignItems: 'flex-end', transformOrigin: 'bottom right' }}>
        <Cat size={58} style={{ marginBottom: 2 }} />
        <Tombstone size={58} lines={['✝']} style={{ marginBottom: 4 }} />
        <Pumpkin size={84} />
      </div>
    </>
  )
}

// ─── Noël ─────────────────────────────────────────────────────────────────────

const AMPOULES = ['#E53935', '#FFC94D', '#2E9E4F', '#B266FF', '#4FC3F7']
const BOULES = ['#E53935', '#FFC94D', '#8B00FF', '#2E9E4F']

function Noel() {
  return (
    <>
      {/* neige (et quelques flocons dessinés) */}
      <Chute n={110} nMobile={45} seed={7} render={(i, v) => {
        const r = v()
        if (i % 9 === 0) return <span style={{ color: '#fff', opacity: .8, fontSize: 12 + r * 10, lineHeight: 1 }}>❄</span>
        const s = 2 + r * 5
        return <span style={{ display: 'block', width: s, height: s, borderRadius: '50%', background: '#fff', opacity: 0.45 + r * 0.5, filter: r > 0.75 ? 'blur(1px)' : undefined }} />
      }} />
      {/* guirlande lumineuse et boules qui pendent */}
      <Fil couleur="#2B3A2E">
        {(x, y, i) => i % 6 === 4 ? (
          <div key={i} style={{ position: 'absolute', left: x - 12, top: y, transformOrigin: 'top center', animation: `sd-swing ${2.4 + (i % 3) * 0.6}s ease-in-out ${-i * 0.4}s infinite` }}>
            <div style={{ width: 1, height: 18 + (i % 4) * 8, background: 'rgba(255,201,77,.6)', margin: '0 auto' }} />
            <Bauble size={24} color={BOULES[i % 4]} />
          </div>
        ) : (
          <span key={i} style={{
            position: 'absolute', left: x - 4, top: y - 1, width: 8, height: 12, borderRadius: '50% 50% 45% 45%',
            background: AMPOULES[i % 5], boxShadow: `0 0 10px 2px ${AMPOULES[i % 5]}`,
            animation: `sd-twinkle ${1.4 + (i % 3) * 0.5}s ease-in-out ${-(i % 5) * 0.37}s infinite`,
          }} />
        )}
      </Fil>
      {/* le traîneau du Père Noël traverse le ciel */}
      <div className="sd sd-moving" style={{ top: 120, left: 0, animation: 'sd-sleigh 26s linear 1s infinite' }}>
        <div style={{ animation: 'sd-bob 1.6s ease-in-out infinite' }}><Sleigh size={300} /></div>
      </div>
      {/* scène du bas : sol enneigé, sapin, cadeaux, cannes en sucre, bonhomme de neige, lutin */}
      <div className="sd" style={{ bottom: 0, left: 0, right: 0, height: 40 }}>
        <svg width="100%" height="40" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden>
          <path d="M0 22C80 10 160 24 260 16S440 6 560 18 780 8 880 16 960 12 1000 16V40H0z" fill="#EEF3FF" />
          <path d="M0 22C80 10 160 24 260 16S440 6 560 18 780 8 880 16 960 12 1000 16" stroke="#C9D6F2" strokeWidth="2" fill="none" />
        </svg>
      </div>
      <div className="sd sd-scene" style={{ bottom: 10, left: 0, display: 'flex', alignItems: 'flex-end', transformOrigin: 'bottom left' }}>
        <ChristmasTree size={200} style={{ marginRight: -30 }} />
        <Gifts size={130} />
        <CandyCane size={58} style={{ marginLeft: 4 }} />
      </div>
      <div className="sd sd-desktop" style={{ bottom: 12, left: '40%', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <CandyCane size={46} />
        <Gifts size={80} />
        <CandyCane size={52} style={{ transform: 'scaleX(-1)' }} />
      </div>
      <div className="sd sd-scene" style={{ bottom: 10, right: 0, display: 'flex', alignItems: 'flex-end', transformOrigin: 'bottom right' }}>
        <div style={{ width: 90, height: 84, overflow: 'hidden', marginRight: -10 }}>
          <div style={{ animation: 'sd-peek 9s ease-in-out 2s infinite', transform: 'translateY(105%)' }}><Elf size={88} /></div>
        </div>
        <Snowman size={130} style={{ marginRight: 8 }} />
      </div>
    </>
  )
}

// ─── Black Friday ─────────────────────────────────────────────────────────────

const TICKER = 'BLACK FRIDAY ✦ VÉRIFIE LE CODE DE TON CRÉATEUR AVANT DE PAYER ✦ '

function Bandeau({ position, sens }: { position: 'top' | 'bottom'; sens: 1 | -1 }) {
  return (
    <div className="sd" style={{ [position]: position === 'top' ? 64 : 0, left: 0, right: 0, height: 30, zIndex: 99, background: '#000', borderTop: position === 'bottom' ? '1px solid rgba(255,255,255,.14)' : undefined, borderBottom: position === 'top' ? '1px solid rgba(255,255,255,.14)' : undefined, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: `${sens === 1 ? 'sd-marquee' : 'sd-marquee-rev'} 26s linear infinite` }}>
        {[0, 1].map((k) => (
          <span key={k} style={{ fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 13, letterSpacing: '.08em', color: '#F4F2EE', paddingRight: 8 }}>
            {TICKER.repeat(6)}
          </span>
        ))}
      </div>
    </div>
  )
}

const ETIQUETTES = ['-%', '%', '€', '-%', 'PROMO']

function BlackFriday() {
  return (
    <>
      <Bandeau position="top" sens={1} />
      <Bandeau position="bottom" sens={-1} />
      {/* étiquettes qui tombent */}
      <Chute n={30} nMobile={7} seed={13} render={(i, v) => (
        <span className="sd-tag" style={{ display: 'block', opacity: .5 + v() * .35 }}><PriceTag size={22 + v() * 16} label={ETIQUETTES[i % 5]} /></span>
      )} />
      {/* étiquettes qui se balancent */}
      {[{ left: '3%', label: '-20%', d: 3.2 }, { right: '4%', label: '-50%', d: 2.7 }, { left: '10%', label: '-%', d: 3.8 }, { right: '11%', label: '%', d: 3.4 }].map((t, i) => (
        <div key={i} className="sd sd-desktop" style={{ top: 94, left: t.left, right: t.right, transformOrigin: 'top center', animation: `sd-swing ${t.d}s ease-in-out ${-i}s infinite` }}>
          <PriceTag size={46} label={t.label} />
        </div>
      ))}
      {/* sacs de shopping */}
      <div className="sd sd-scene" style={{ bottom: 30, left: 6, display: 'flex', alignItems: 'flex-end', transformOrigin: 'bottom left' }}>
        <ShoppingBag size={96} color="#8B00FF" label="B" />
        <ShoppingBag size={70} color="#F4F2EE" ink="#07080F" label="%" style={{ marginLeft: -16 }} />
      </div>
      <div className="sd sd-scene" style={{ bottom: 30, right: 6, display: 'flex', alignItems: 'flex-end', transformOrigin: 'bottom right' }}>
        <ShoppingBag size={64} color="#F4F2EE" ink="#07080F" label="€" style={{ marginRight: -14 }} />
        <ShoppingBag size={90} color="#8B00FF" label="-%" />
      </div>
    </>
  )
}

// ─── Décor dans le haut de l'accueil (derrière le titre) ─────────────────────

export function SaisonHero() {
  const s = useSaisons()[0]
  if (!s || !DECOREES.includes(s.id)) return null
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '32%', left: '50%', transform: 'translate(-50%, -50%)', width: 900, height: 600,
        background: `radial-gradient(ellipse, ${s.couleur}33 0%, transparent 62%)`,
      }} />
      {s.id === 'halloween' && (
        <>
          <div className="sd-desktop" style={{ position: 'absolute', top: '13%', right: '14%' }}>
            <Moon size={150} style={{ filter: 'drop-shadow(0 0 40px rgba(255,230,150,.35))' }} />
          </div>
          <div className="sd-moving" style={{ position: 'absolute', top: '16%', left: 0, animation: 'sd-witch 22s linear 1s infinite' }}>
            <div style={{ animation: 'sd-bob 2s ease-in-out infinite' }}><Witch size={150} /></div>
          </div>
        </>
      )}
      {s.id === 'noel' && (
        <>
          {Array.from({ length: 26 }, (_, i) => {
            const r = rand(100 + i)
            const size = 2 + r() * 3
            return <span key={i} style={{ position: 'absolute', top: `${8 + r() * 50}%`, left: `${r() * 100}%`, width: size, height: size, borderRadius: '50%', background: '#FFE9A8', boxShadow: '0 0 8px #FFE9A8', animation: `sd-twinkle ${1.5 + r() * 2}s ease-in-out ${-r() * 3}s infinite` }} />
          })}
          <span className="sd-moving" style={{ position: 'absolute', top: '10%', right: '8%', width: 120, height: 2, background: 'linear-gradient(90deg, transparent, #fff)', transform: 'rotate(-28deg)', animation: 'sd-shoot 7s ease-in 2s infinite' }} />
        </>
      )}
      {s.id === 'black-friday' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-8deg)', whiteSpace: 'nowrap',
          fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 'clamp(70px, 14vw, 190px)', letterSpacing: '-0.02em',
          color: 'transparent', WebkitTextStroke: '1.5px rgba(244,242,238,.13)',
        }}>BLACK FRIDAY</div>
      )}
    </div>
  )
}

export default function SaisonDecor() {
  const s = useSaisons()[0]
  const id = s && DECOREES.includes(s.id) ? s.id : null
  useEffect(() => {
    if (!id) return
    document.documentElement.dataset.saison = id
    return () => { delete document.documentElement.dataset.saison }
  }, [id])
  if (!id) return null
  return (
    <div aria-hidden>
      <style>{CSS}</style>
      {id === 'halloween' && <Halloween />}
      {id === 'noel' && <Noel />}
      {id === 'black-friday' && <BlackFriday />}
    </div>
  )
}
