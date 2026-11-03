'use client'
import { useEffect, useRef, useState } from 'react'

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'

// Le code à copier, dans le style des vidéos : au clic, il se dévoile lettre par lettre (en brouillant),
// il est copié, puis « ✓ Copié ! ». `masked` cache la seconde moitié tant qu'on n'a pas cliqué.
export default function CodeChip({
  code, masked = false, size = 'md', onCopy,
}: { code: string; masked?: boolean; size?: 'md' | 'lg'; onCopy?: () => void }) {
  const visible = Math.max(2, Math.ceil(code.length / 2))
  const [shown, setShown] = useState<string[]>(() => initial())
  const [revealed, setRevealed] = useState(!masked)
  const [copied, setCopied] = useState(false)
  const raf = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function initial() {
    return code.split('').map((c, i) => (masked && i >= visible ? '•' : c))
  }

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current)
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const scramble = () => {
    const from = revealed ? 0 : visible // déjà visible : tout le code brouille brièvement
    const start = performance.now()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setShown(code.split('')); return }
    const step = (now: number) => {
      const t = (now - start) / 1000
      let done = true
      const next = code.split('').map((c, i) => {
        if (i < from) return c
        const at = (i - from) * 0.045
        if (t >= at + 0.16) return c
        done = false
        return t >= at ? GLYPHS[(Math.floor(now / 33) * 7 + i * 13) % GLYPHS.length] : (revealed ? c : '•')
      })
      setShown(next)
      if (!done) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  const handle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    navigator.clipboard?.writeText(code).catch(() => {})
    scramble()
    setRevealed(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(true), 420)
    setTimeout(() => setCopied(false), 2600)
    onCopy?.()
  }

  return (
    <button
      type="button"
      className={`code-chip code-chip-${size}${copied ? ' is-copied' : ''}${revealed ? ' is-revealed' : ''}`}
      onClick={handle}
      aria-label={`Copier le code ${code}`}
    >
      <span className="code-chip-code" aria-hidden={copied}>
        {shown.map((c, i) => (
          <span key={i} className={c === '•' || c !== code[i] ? 'code-chip-dim' : undefined}>{c}</span>
        ))}
      </span>
      <span className="code-chip-ok" aria-hidden={!copied}>✓ Copié !</span>
      <span className="code-chip-hint">Copier</span>
    </button>
  )
}
