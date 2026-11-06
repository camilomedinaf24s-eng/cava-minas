/** Dig HD miner (CAVA) — silueta delgada; hacha visible */

import type { RankId } from '../game/ranks'

const PAL: Record<
  RankId,
  {
    shirt: string
    pants: string
    helm: string
    lamp: string
    metal: string
    accent: string
    cape?: string
    fur?: string
  }
> = {
  1: {
    shirt: '#7a4a28',
    pants: '#4a3020',
    helm: '#6b4423',
    lamp: 'none',
    metal: '#8a9098',
    accent: '#c8b090',
  },
  2: {
    shirt: '#5c3a22',
    pants: '#3a2818',
    helm: '#6b4423',
    lamp: '#ffe27a',
    metal: '#a8b0b8',
    accent: '#c0392b',
  },
  3: {
    shirt: '#2a5aaa',
    pants: '#1a3a6a',
    helm: '#708090',
    lamp: '#fff8c0',
    metal: '#c0c8d0',
    accent: '#4ad2ff',
  },
  4: {
    shirt: '#1e4a8a',
    pants: '#142848',
    helm: '#d4a017',
    lamp: '#ffe27a',
    metal: '#ffe27a',
    accent: '#c44dff',
  },
  5: {
    shirt: '#1a2a44',
    pants: '#0e1828',
    helm: '#9aa8b8',
    lamp: '#7ec8ff',
    metal: '#c9a227',
    accent: '#4ad2ff',
    cape: '#2a5aaa',
    fur: '#f0ebe0',
  },
  6: {
    shirt: '#3a1848',
    pants: '#1a0a28',
    helm: '#ffe27a',
    lamp: '#ffa0ff',
    metal: '#ffe27a',
    accent: '#c44dff',
    cape: '#f5f0e8',
    fur: '#ffffff',
  },
}

const AXE: Record<number, { head: string; gem: string }> = {
  1: { head: '#9aa0a6', gem: '#cfc4b4' },
  2: { head: '#8aa890', gem: '#6fd97a' },
  3: { head: '#6eb0e0', gem: '#4ad2ff' },
  4: { head: '#ffe27a', gem: '#c44dff' },
  5: { head: '#7ec8ff', gem: '#4ad2ff' },
  6: { head: '#e080ff', gem: '#ff4a3a' },
}

type Props = { rank: RankId; axeId?: number; omitAxe?: boolean; className?: string }

/** Vista 160×200; cuerpo estrecho (~0.72 del ancho stocky anterior) */
export function DigMinerArt({ rank, axeId = 1, omitAxe = false, className = '' }: Props) {
  const p = PAL[rank]
  const a = AXE[Math.min(6, Math.max(1, axeId))]
  const lamp = p.lamp !== 'none'

  return (
    <svg className={`dig-miner-art thin ${className}`} viewBox="0 0 160 200" width="100%" height="100%" aria-hidden>
      <defs>
        <linearGradient id={`mbody-${rank}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.shirt} />
          <stop offset="100%" stopColor={p.pants} />
        </linearGradient>
        <linearGradient id={`mhelm-${rank}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.helm} />
          <stop offset="100%" stopColor={p.pants} />
        </linearGradient>
        <radialGradient id={`mlamp-${rank}`} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="55%" stopColor={lamp ? p.lamp : '#888'} />
          <stop offset="100%" stopColor={lamp ? p.lamp : '#888'} stopOpacity="0.15" />
        </radialGradient>
        <filter id={`mg-${rank}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="80" cy="188" rx="34" ry="7" fill="#2a241c" opacity="0.5" />

      {p.cape && (
        <>
          <path
            d="M54 76 Q36 108 42 168 Q80 152 118 168 Q124 108 106 76 Z"
            fill={p.cape}
            stroke="#000"
            strokeWidth="1.1"
            opacity="0.92"
          />
          {p.fur && (
            <path d="M56 74 Q80 84 104 74 Q94 68 80 69 Q66 68 56 74" fill={p.fur} stroke="#000" strokeWidth="1" />
          )}
        </>
      )}

      {/* legs — thin */}
      <rect x="64" y="136" width="12" height="38" rx="4" fill={p.pants} stroke="#000" strokeWidth="1.3" />
      <rect x="84" y="136" width="12" height="38" rx="4" fill={p.pants} stroke="#000" strokeWidth="1.3" />
      <rect x="60" y="168" width="18" height="10" rx="2.5" fill="#1a1208" stroke="#000" strokeWidth="1" />
      <rect x="82" y="168" width="18" height="10" rx="2.5" fill="#1a1208" stroke="#000" strokeWidth="1" />

      {/* torso — narrow */}
      <path
        d="M58 74 Q80 64 102 74 L106 136 Q80 148 54 136 Z"
        fill={`url(#mbody-${rank})`}
        stroke="#000"
        strokeWidth="1.5"
      />
      {rank >= 3 && (
        <>
          <path d="M54 78 L66 74 L68 96 L52 98 Z" fill={p.metal} stroke="#000" strokeWidth="1" />
          <path d="M106 78 L94 74 L92 96 L108 98 Z" fill={p.metal} stroke="#000" strokeWidth="1" />
        </>
      )}
      {rank >= 5 && (
        <circle cx="80" cy="108" r="6" fill={p.accent} filter={`url(#mg-${rank})`} stroke="#000" strokeWidth="1" />
      )}

      {/* arms — slim */}
      <rect x="44" y="80" width="12" height="42" rx="5" fill={`url(#mbody-${rank})`} stroke="#000" strokeWidth="1.2" />
      <rect x="104" y="80" width="12" height="42" rx="5" fill={`url(#mbody-${rank})`} stroke="#000" strokeWidth="1.2" />
      <ellipse cx="50" cy="126" rx="6.5" ry="6" fill="#d4a574" stroke="#000" strokeWidth="1" />
      <ellipse cx="110" cy="126" rx="6.5" ry="6" fill="#d4a574" stroke="#000" strokeWidth="1" />

      {/* head — less wide */}
      <ellipse cx="80" cy="50" rx="17" ry="22" fill="#e8b888" stroke="#000" strokeWidth="1.4" />
      <path d="M66 56 Q80 72 94 56 Q90 66 80 70 Q70 66 66 56" fill="#8b5a2b" stroke="#000" strokeWidth="1" />
      <ellipse cx="73" cy="48" rx="2.2" ry="3.2" fill="#1a1208" />
      <ellipse cx="87" cy="48" rx="2.2" ry="3.2" fill="#1a1208" />
      <path d="M76 58 Q80 61 84 58" fill="none" stroke="#c88848" strokeWidth="1.4" />

      {/* hard hat */}
      <path d="M62 40 Q80 20 98 40 L96 50 Q80 56 64 50 Z" fill={`url(#mhelm-${rank})`} stroke="#000" strokeWidth="1.4" />
      <ellipse cx="80" cy="40" rx="20" ry="5" fill={p.helm} stroke="#000" strokeWidth="1" opacity="0.85" />
      {lamp && (
        <g filter={`url(#mg-${rank})`}>
          <circle cx="80" cy="28" r="7" fill={`url(#mlamp-${rank})`} stroke="#000" strokeWidth="1.1" />
        </g>
      )}
      {rank === 6 && (
        <path d="M64 30 L69 16 L75 28 L80 12 L85 28 L91 16 L96 30 Z" fill={p.metal} stroke="#000" strokeWidth="1" />
      )}
      {rank === 2 && (
        <path d="M64 56 Q80 66 96 56" fill="none" stroke={p.accent} strokeWidth="4" strokeLinecap="round" />
      )}

      {/* pick over shoulder */}
      {!omitAxe && (
        <g transform="translate(102,66) rotate(-48)" filter={axeId >= 4 ? `url(#mg-${rank})` : undefined}>
          <rect x="10" y="12" width="6" height="52" rx="2" fill="#6b4423" stroke="#000" strokeWidth="1.1" />
          <path d="M-4 8 L16 -6 L30 8 L16 22 Z" fill={a.head} stroke="#000" strokeWidth="1.3" />
          <path d="M30 8 L50 -4 L62 8 L50 20 Z" fill={a.head} stroke="#000" strokeWidth="1.3" />
          <circle cx="30" cy="8" r="5" fill={a.gem} stroke="#000" strokeWidth="1" />
        </g>
      )}
    </svg>
  )
}
