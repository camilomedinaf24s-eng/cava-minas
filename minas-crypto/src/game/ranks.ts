/** 6 ranks Dig-style (CAVA) — ref media/ref-miner-levels-dig.png */

export type RankId = 1 | 2 | 3 | 4 | 5 | 6

export type DisplayAttrs = {
  fuerza: number
  resistencia: number
  productividad: number
}

export type RankDef = {
  rank: RankId
  name: string
  rarity: string
  /** Color rareza / borde card */
  color: string
  /** Fondo card */
  cardBg: string
  attrs: DisplayAttrs
  look: string
}

export const RANKS: RankDef[] = [
  {
    rank: 1,
    name: 'Minero Básico',
    rarity: 'Común',
    color: '#b0b4ba',
    cardBg: '#2a2e34',
    attrs: { fuerza: 10, resistencia: 10, productividad: 10 },
    look: 'Casco · camisa · chaleco',
  },
  {
    rank: 2,
    name: 'Minero Novato',
    rarity: 'Poco Común',
    color: '#6fd97a',
    cardBg: '#1a3a20',
    attrs: { fuerza: 20, resistencia: 25, productividad: 20 },
    look: 'Lámpara · mochila cuero',
  },
  {
    rank: 3,
    name: 'Minero Avanzado',
    rarity: 'Raro',
    color: '#4ad2ff',
    cardBg: '#0e2a44',
    attrs: { fuerza: 35, resistencia: 40, productividad: 40 },
    look: 'Traje azul · hombreras',
  },
  {
    rank: 4,
    name: 'Minero Experto',
    rarity: 'Épico',
    color: '#c44dff',
    cardBg: '#2a0e44',
    attrs: { fuerza: 55, resistencia: 60, productividad: 60 },
    look: 'Placas oro · lámpara dorada',
  },
  {
    rank: 5,
    name: 'Minero Élite',
    rarity: 'Legendario',
    color: '#ffb020',
    cardBg: '#3a2008',
    attrs: { fuerza: 75, resistencia: 80, productividad: 85 },
    look: 'Capa · cristales cyan',
  },
  {
    rank: 6,
    name: 'Minero Legendario',
    rarity: 'Mítico',
    color: '#ff4a3a',
    cardBg: '#3a0c08',
    attrs: { fuerza: 100, resistencia: 100, productividad: 100 },
    look: 'Corona · capa · púrpura',
  },
]

export const MAX_RANK = 6 as const

export function getRank(rank: number): RankDef {
  const r = Math.min(MAX_RANK, Math.max(1, Math.floor(rank))) as RankId
  return RANKS[r - 1]
}

/** Hash rate MINE/h desde F/R/P Dig */
export function rateFromAttrs(a: DisplayAttrs, skillMult = 1): number {
  // Productividad pesa más; fuerza pega; resistencia sostiene
  return (a.productividad * 1.35 + a.fuerza * 0.7 + a.resistencia * 0.45) * skillMult
}

export function upgradeRankCost(rank: number): number {
  // Costos crecientes hacia mítico
  const table = [0, 40, 90, 180, 320, 520]
  return table[Math.min(5, Math.max(1, rank))] ?? 520
}
