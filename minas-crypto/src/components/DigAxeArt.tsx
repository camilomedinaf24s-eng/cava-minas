/** Dig HD pickaxe cards (CAVA) — dual head + gem + rock mound */

type Props = { axeId: number; className?: string; compact?: boolean }

const THEME: Record<
  number,
  { head: string; headDark: string; gem: string; wrap: string; glow: string; rock: string; aura: string }
> = {
  1: {
    head: '#b0b6bc',
    headDark: '#6a7078',
    gem: '#d0c8b8',
    wrap: '#8b5a2b',
    glow: 'transparent',
    rock: '#5a5248',
    aura: '#0000',
  },
  2: {
    head: '#9ab89a',
    headDark: '#3a8a44',
    gem: '#6fd97a',
    wrap: '#2e6b36',
    glow: '#6fd97a',
    rock: '#3a5a3e',
    aura: '#6fd97a55',
  },
  3: {
    head: '#7ec8ff',
    headDark: '#1a6a9a',
    gem: '#4ad2ff',
    wrap: '#1a3a6a',
    glow: '#4ad2ff',
    rock: '#2a4a6a',
    aura: '#4ad2ff66',
  },
  4: {
    head: '#ffe27a',
    headDark: '#c4894a',
    gem: '#c44dff',
    wrap: '#6a1a9a',
    glow: '#c44dff',
    rock: '#4a2a58',
    aura: '#c44dff77',
  },
  5: {
    head: '#7ef0ff',
    headDark: '#2a5aaa',
    gem: '#4ad2ff',
    wrap: '#c9a227',
    glow: '#ffe27a',
    rock: '#3a3a20',
    aura: '#ffe27a88',
  },
  6: {
    head: '#ff80ff',
    headDark: '#6a1a9a',
    gem: '#ff4a3a',
    wrap: '#ffe27a',
    glow: '#ff6a3a',
    rock: '#3a1008',
    aura: '#ff4a3a99',
  },
}

export function DigAxeArt({ axeId, className = '', compact = false }: Props) {
  const id = Math.min(6, Math.max(1, Math.floor(axeId)))
  const t = THEME[id]
  const vb = compact ? '20 0 100 120' : '0 0 140 180'

  return (
    <svg className={`dig-axe-art ${className}`} viewBox={vb} width="100%" height="100%" aria-hidden>
      <defs>
        <linearGradient id={`hdh-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={t.head} />
          <stop offset="100%" stopColor={t.headDark} />
        </linearGradient>
        <radialGradient id={`hdg-${id}`} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="60%" stopColor={t.gem} />
          <stop offset="100%" stopColor={t.gem} stopOpacity="0.35" />
        </radialGradient>
        <filter id={`hdglow-${id}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {!compact && (
        <>
          <ellipse cx="70" cy="160" rx="52" ry="14" fill={t.aura} />
          <path
            d="M28 152 Q50 128 70 148 Q90 126 112 154 Q70 172 28 152"
            fill={t.rock}
            stroke="#000"
            strokeWidth="1.2"
          />
        </>
      )}

      {/* shaft */}
      <rect x="65" y={compact ? 48 : 68} width="12" height={compact ? 55 : 78} rx="3" fill="#7a4a28" stroke="#000" strokeWidth="1.5" />
      <rect x="62" y={compact ? 88 : 118} width="18" height={compact ? 16 : 22} rx="3" fill={t.wrap} stroke="#000" strokeWidth="1.1" />

      <g filter={id >= 3 ? `url(#hdglow-${id})` : undefined}>
        {/* dual pick head */}
        <path d="M14 44 L55 22 L70 46 L55 70 Z" fill={`url(#hdh-${id})`} stroke="#000" strokeWidth="1.7" />
        <path d="M126 44 L85 22 L70 46 L85 70 Z" fill={`url(#hdh-${id})`} stroke="#000" strokeWidth="1.7" />
        <ellipse cx="70" cy="46" rx="18" ry="15" fill={`url(#hdh-${id})`} stroke="#000" strokeWidth="1.5" />
        <circle cx="70" cy="46" r={id === 1 ? 5 : 9} fill={`url(#hdg-${id})`} stroke="#000" strokeWidth="1.2" />
        {id >= 5 && (
          <>
            <path d="M38 34 L48 12 L58 34" fill={t.head} stroke="#000" strokeWidth="1.1" />
            <path d="M82 34 L92 12 L102 34" fill={t.head} stroke="#000" strokeWidth="1.1" />
          </>
        )}
        {id === 6 && (
          <>
            <circle cx="48" cy="28" r="3.5" fill="#ff6a3a" />
            <circle cx="92" cy="28" r="3.5" fill="#ff6a3a" />
            <circle cx="70" cy="18" r="3" fill="#ffe27a" />
          </>
        )}
      </g>
    </svg>
  )
}
