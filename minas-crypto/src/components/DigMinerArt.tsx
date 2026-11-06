/** Dig HD miner illustration (CAVA) — stocky Dig-like, no Dig/GoArbit logos */

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

export function DigMinerArt({ rank, axeId = 1, omitAxe = false, className = '' }: Props) {
  const p = PAL[rank]
  const a = AXE[Math.min(6, Math.max(1, axeId))]
  const lamp = p.lamp !== 'none'

  return (
    <svg className={`dig-miner-art ${className}`} viewBox="0 0 160 200" width="100%" height="100%" aria-hidden>
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
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* pedestal hint for cards */}
      <ellipse cx="80" cy="188" rx="46" ry="8" fill="#2a241c" opacity="0.55" />

      {p.cape && (
        <>
          <path d="M42 78 Q18 110 30 170 Q80 150 130 170 Q142 110 118 78 Z" fill={p.cape} stroke="#000" strokeWidth="1.2" />
          {p.fur && <path d="M44 76 Q80 88 116 76 Q100 68 80 70 Q60 68 44 76" fill={p.fur} stroke="#000" strokeWidth="1" />}
        </>
      )}

      {/* legs stocky */}
      <rect x="54" y="138" width="20" height="36" rx="5" fill={p.pants} stroke="#000" strokeWidth="1.4" />
      <rect x="86" y="138" width="20" height="36" rx="5" fill={p.pants} stroke="#000" strokeWidth="1.4" />
      <rect x="50" y="168" width="26" height="12" rx="3" fill="#1a1208" stroke="#000" strokeWidth="1" />
      <rect x="84" y="168" width="26" height="12" rx="3" fill="#1a1208" stroke="#000" strokeWidth="1" />

      {/* torso */}
      <path
        d="M44 78 Q80 66 116 78 L122 140 Q80 156 38 140 Z"
        fill={`url(#mbody-${rank})`}
        stroke="#000"
        strokeWidth="1.6"
      />
      {rank >= 3 && (
        <>
          <path d="M40 82 L58 78 L62 102 L38 104 Z" fill={p.metal} stroke="#000" strokeWidth="1.1" />
          <path d="M120 82 L102 78 L98 102 L122 104 Z" fill={p.metal} stroke="#000" strokeWidth="1.1" />
        </>
      )}
      {rank >= 5 && (
        <circle cx="80" cy="110" r="8" fill={p.accent} filter={`url(#mg-${rank})`} stroke="#000" strokeWidth="1" />
      )}

      {/* arms */}
      <rect x="28" y="84" width="18" height="40" rx="7" fill={`url(#mbody-${rank})`} stroke="#000" strokeWidth="1.3" />
      <rect x="114" y="84" width="18" height="40" rx="7" fill={`url(#mbody-${rank})`} stroke="#000" strokeWidth="1.3" />
      <ellipse cx="37" cy="128" rx="9" ry="8" fill="#d4a574" stroke="#000" strokeWidth="1.1" />
      <ellipse cx="123" cy="128" rx="9" ry="8" fill="#d4a574" stroke="#000" strokeWidth="1.1" />

      {/* head + beard */}
      <ellipse cx="80" cy="52" rx="24" ry="26" fill="#e8b888" stroke="#000" strokeWidth="1.5" />
      <path d="M58 58 Q80 78 102 58 Q96 72 80 76 Q64 72 58 58" fill="#8b5a2b" stroke="#000" strokeWidth="1" />
      <ellipse cx="70" cy="50" rx="3" ry="4" fill="#1a1208" />
      <ellipse cx="90" cy="50" rx="3" ry="4" fill="#1a1208" />
      <path d="M74 60 Q80 64 86 60" fill="none" stroke="#c88848" strokeWidth="1.6" />

      {/* hard hat */}
      <path d="M54 42 Q80 18 106 42 L104 52 Q80 60 56 52 Z" fill={`url(#mhelm-${rank})`} stroke="#000" strokeWidth="1.5" />
      <ellipse cx="80" cy="42" rx="28" ry="6" fill={p.helm} stroke="#000" strokeWidth="1" opacity="0.85" />
      {lamp && (
        <g filter={`url(#mg-${rank})`}>
          <circle cx="80" cy="28" r="9" fill={`url(#mlamp-${rank})`} stroke="#000" strokeWidth="1.2" />
        </g>
      )}
      {rank === 6 && (
        <path d="M58 30 L64 14 L72 28 L80 10 L88 28 L96 14 L102 30 Z" fill={p.metal} stroke="#000" strokeWidth="1.1" />
      )}
      {rank === 2 && <path d="M56 58 Q80 70 104 58" fill="none" stroke={p.accent} strokeWidth="5" strokeLinecap="round" />}

      {/* pick over shoulder — always on cards */}
      {!omitAxe && (
        <g transform="translate(108,70) rotate(-48)" filter={axeId >= 4 ? `url(#mg-${rank})` : undefined}>
          <rect x="10" y="14" width="7" height="58" rx="2" fill="#6b4423" stroke="#000" strokeWidth="1.2" />
          <path d="M-6 10 L18 -6 L34 10 L18 26 Z" fill={a.head} stroke="#000" strokeWidth="1.4" />
          <path d="M34 10 L58 -4 L72 10 L58 24 Z" fill={a.head} stroke="#000" strokeWidth="1.4" />
          <circle cx="34" cy="10" r="6" fill={a.gem} stroke="#000" strokeWidth="1" />
        </g>
      )}
    </svg>
  )
}
