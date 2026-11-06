/** Dig-style illustrated miners (CAVA) — vector, no Dig/GoArbit logos */

import type { RankId } from '../game/ranks'

const PAL: Record<
  RankId,
  { suit: string; suitDark: string; accent: string; lamp: string; metal: string; cape?: string }
> = {
  1: { suit: '#8b5a2b', suitDark: '#5a3a1e', accent: '#e8dcc8', lamp: '#ffe27a', metal: '#9aa0a6' },
  2: { suit: '#6b4423', suitDark: '#3a2a1a', accent: '#c4894a', lamp: '#fff59a', metal: '#b0b4ba' },
  3: { suit: '#2a5aaa', suitDark: '#1a3a6a', accent: '#4ad2ff', lamp: '#ffffff', metal: '#c0c8d0' },
  4: { suit: '#1a3a6a', suitDark: '#0e2040', accent: '#ffe27a', lamp: '#ffb020', metal: '#ffe27a' },
  5: { suit: '#142238', suitDark: '#0a121c', accent: '#4ad2ff', lamp: '#7ec8ff', metal: '#c9a227', cape: '#e8e0d0' },
  6: { suit: '#2a0e44', suitDark: '#140820', accent: '#ff4a3a', lamp: '#ffa0ff', metal: '#ffe27a', cape: '#f5f0e8' },
}

type Props = { rank: RankId; axeId?: number; omitAxe?: boolean; className?: string }

export function DigMinerArt({ rank, axeId = 1, omitAxe = false, className = '' }: Props) {
  const p = PAL[rank]
  const showCrown = rank === 6
  const showCape = rank >= 5
  const showGold = rank >= 4
  const axeHue =
    axeId >= 6 ? '#c44dff' : axeId >= 5 ? '#4ad2ff' : axeId >= 4 ? '#ffe27a' : axeId >= 3 ? '#7ec8ff' : axeId >= 2 ? '#6fd97a' : '#9aa0a6'

  return (
    <svg
      className={`dig-miner-art ${className}`}
      viewBox="0 0 120 150"
      width="100%"
      height="100%"
      aria-hidden
    >
      <defs>
        <linearGradient id={`body-${rank}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.suit} />
          <stop offset="100%" stopColor={p.suitDark} />
        </linearGradient>
        <linearGradient id={`helm-${rank}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.metal} />
          <stop offset="100%" stopColor={p.suitDark} />
        </linearGradient>
        <radialGradient id={`lamp-${rank}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="55%" stopColor={p.lamp} />
          <stop offset="100%" stopColor={p.lamp} stopOpacity="0.2" />
        </radialGradient>
        <filter id={`glow-${rank}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {showCape && (
        <path
          d="M38 72 Q20 100 28 138 Q60 128 92 138 Q100 100 82 72 Z"
          fill={p.cape ?? '#ddd'}
          opacity="0.95"
        />
      )}

      {/* legs */}
      <rect x="44" y="108" width="14" height="28" rx="3" fill={p.suitDark} />
      <rect x="62" y="108" width="14" height="28" rx="3" fill={p.suitDark} />
      <rect x="42" y="132" width="18" height="8" rx="2" fill="#1a1208" />
      <rect x="60" y="132" width="18" height="8" rx="2" fill="#1a1208" />

      {/* torso */}
      <path
        d="M36 70 Q60 62 84 70 L88 108 Q60 118 32 108 Z"
        fill={`url(#body-${rank})`}
        stroke="#000"
        strokeWidth="1.5"
      />
      {showGold && (
        <>
          <rect x="34" y="74" width="16" height="14" rx="3" fill={p.metal} stroke="#000" strokeWidth="1" />
          <rect x="70" y="74" width="16" height="14" rx="3" fill={p.metal} stroke="#000" strokeWidth="1" />
        </>
      )}
      <rect x="52" y="86" width="16" height="10" rx="2" fill={p.accent} opacity="0.85" />

      {/* arms */}
      <rect x="26" y="74" width="12" height="28" rx="4" fill={`url(#body-${rank})`} stroke="#000" strokeWidth="1" />
      <rect x="82" y="74" width="12" height="28" rx="4" fill={`url(#body-${rank})`} stroke="#000" strokeWidth="1" />
      <circle cx="32" cy="104" r="5" fill="#f0b878" stroke="#000" strokeWidth="1" />
      <circle cx="88" cy="104" r="5" fill="#f0b878" stroke="#000" strokeWidth="1" />

      {/* head */}
      <ellipse cx="60" cy="48" rx="18" ry="20" fill="#f0b878" stroke="#000" strokeWidth="1.5" />
      <ellipse cx="53" cy="48" rx="2.2" ry="3" fill="#1a1208" />
      <ellipse cx="67" cy="48" rx="2.2" ry="3" fill="#1a1208" />
      <path d="M54 58 Q60 62 66 58" fill="none" stroke="#c88848" strokeWidth="1.5" />

      {/* helmet */}
      <path
        d="M40 42 Q60 22 80 42 L78 52 Q60 58 42 52 Z"
        fill={`url(#helm-${rank})`}
        stroke="#000"
        strokeWidth="1.5"
      />
      <circle cx="60" cy="28" r="7" fill={`url(#lamp-${rank})`} filter={`url(#glow-${rank})`} stroke="#000" strokeWidth="1" />
      {showCrown && (
        <path
          d="M44 30 L48 18 L54 28 L60 14 L66 28 L72 18 L76 30 Z"
          fill={p.metal}
          stroke="#000"
          strokeWidth="1"
        />
      )}

      {/* held pick */}
      {!omitAxe && (
        <g transform="translate(86,78) rotate(-25)">
          <rect x="8" y="10" width="4" height="36" rx="1" fill="#8b5a2b" stroke="#000" strokeWidth="1" />
          <path
            d="M0 8 L20 0 L28 8 L20 16 L0 10 Z"
            fill={axeHue}
            stroke="#000"
            strokeWidth="1.2"
            filter={axeId >= 4 ? `url(#glow-${rank})` : undefined}
          />
          <circle cx="14" cy="8" r="3" fill="#fff" opacity="0.7" />
        </g>
      )}
    </svg>
  )
}
