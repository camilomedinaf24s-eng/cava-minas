/** Dig-style illustrated pickaxes (CAVA) — vector, no Dig/GoArbit logos */

type Props = { axeId: number; className?: string }

const THEME: Record<
  number,
  { head: string; headDark: string; gem: string; wrap: string; glow: string; rock: string }
> = {
  1: { head: '#9aa0a6', headDark: '#6a7078', gem: '#cfc4b4', wrap: '#8b5a2b', glow: 'transparent', rock: '#5a5e64' },
  2: { head: '#8aa890', headDark: '#3a8a44', gem: '#6fd97a', wrap: '#3a8a44', glow: '#6fd97a44', rock: '#4a6a4e' },
  3: { head: '#6eb0e0', headDark: '#1a6a9a', gem: '#4ad2ff', wrap: '#1a3a6a', glow: '#4ad2ff55', rock: '#3a5a7a' },
  4: { head: '#ffe27a', headDark: '#d4a017', gem: '#c44dff', wrap: '#6a1a9a', glow: '#c44dff66', rock: '#5a3a1e' },
  5: { head: '#7ec8ff', headDark: '#2a5aaa', gem: '#4ad2ff', wrap: '#c9a227', glow: '#4ad2ff88', rock: '#2a3a4a' },
  6: { head: '#ffa0ff', headDark: '#6a1a9a', gem: '#ff4a3a', wrap: '#ffe27a', glow: '#ff4a3a77', rock: '#3a0c08' },
}

export function DigAxeArt({ axeId, className = '' }: Props) {
  const id = Math.min(6, Math.max(1, Math.floor(axeId)))
  const t = THEME[id]
  const ornate = id >= 4

  return (
    <svg className={`dig-axe-art ${className}`} viewBox="0 0 140 180" width="100%" height="100%" aria-hidden>
      <defs>
        <linearGradient id={`ah-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={t.head} />
          <stop offset="100%" stopColor={t.headDark} />
        </linearGradient>
        <radialGradient id={`ag-${id}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="70%" stopColor={t.gem} />
          <stop offset="100%" stopColor={t.gem} stopOpacity="0.4" />
        </radialGradient>
        <filter id={`aglow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* rock mound */}
      <ellipse cx="70" cy="158" rx="48" ry="14" fill={t.rock} opacity="0.9" />
      <path d="M30 150 Q50 130 70 148 Q90 128 110 152 Q70 168 30 150" fill={t.rock} stroke="#000" strokeWidth="1" />

      {/* shaft */}
      <rect x="66" y="70" width="10" height="78" rx="3" fill="#8b5a2b" stroke="#000" strokeWidth="1.5" />
      <rect x="64" y="118" width="14" height="22" rx="3" fill={t.wrap} stroke="#000" strokeWidth="1" />

      {/* dual head */}
      <g filter={ornate ? `url(#aglow-${id})` : undefined}>
        <path
          d="M18 48 L55 28 L70 48 L55 68 Z"
          fill={`url(#ah-${id})`}
          stroke="#000"
          strokeWidth="1.6"
        />
        <path
          d="M122 48 L85 28 L70 48 L85 68 Z"
          fill={`url(#ah-${id})`}
          stroke="#000"
          strokeWidth="1.6"
        />
        <ellipse cx="70" cy="48" rx="16" ry="14" fill={`url(#ah-${id})`} stroke="#000" strokeWidth="1.5" />
        <circle cx="70" cy="48" r="8" fill={`url(#ag-${id})`} stroke="#000" strokeWidth="1.2" />
        {id >= 5 && (
          <>
            <path d="M40 36 L48 20 L56 36" fill={t.head} stroke="#000" strokeWidth="1" opacity="0.9" />
            <path d="M84 36 L92 20 L100 36" fill={t.head} stroke="#000" strokeWidth="1" opacity="0.9" />
          </>
        )}
        {id === 6 && (
          <>
            <circle cx="48" cy="30" r="3" fill="#ff4a3a" />
            <circle cx="92" cy="30" r="3" fill="#ff4a3a" />
            <circle cx="70" cy="22" r="2.5" fill="#ffe27a" />
          </>
        )}
      </g>

      {/* soft aura */}
      {t.glow !== 'transparent' && (
        <ellipse cx="70" cy="48" rx="54" ry="28" fill={t.glow} opacity="0.45" />
      )}
    </svg>
  )
}
