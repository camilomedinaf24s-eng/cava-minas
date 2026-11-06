/** Mineros NFT DEMO + cajas — Dig Crypto ranks (CAVA) */

import {
  MAX_RANK,
  getRank,
  rateFromAttrs,
  upgradeRankCost,
  type RankId,
} from './ranks'

export type Rarity =
  | 'common'
  | 'rare'
  | 'super_rare'
  | 'epic'
  | 'legendary'
  | 'super_legendary'

export type SkillId =
  | 'sharp'
  | 'swift'
  | 'tank'
  | 'multi'
  | 'reach'
  | 'streak'
  | 'luck'

/** Legacy 5-stat kept for skills mapping; display uses F/R/P from rank */
export type MinerStats = {
  power: number
  speed: number
  stamina: number
  hit: number
  range: number
}

export type Miner = {
  id: string
  name: string
  rarity: Rarity
  skills: SkillId[]
  stats: MinerStats
  /** Rank Dig 1..6 (= nivel visual) */
  level: number
  createdAt: number
  /** Estamina 0..maxEnergy — al 0 está cansado */
  energy: number
  maxEnergy: number
}

export type BoxId = 'common' | 'rare' | 'legendary'

export const RARITY_ORDER: Rarity[] = [
  'common',
  'rare',
  'super_rare',
  'epic',
  'legendary',
  'super_legendary',
]

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Poco Común',
  super_rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
  super_legendary: 'Mítico',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b0b4ba',
  rare: '#6fd97a',
  super_rare: '#4ad2ff',
  epic: '#c44dff',
  legendary: '#ffb020',
  super_legendary: '#ff4a3a',
}

export const RARITY_TO_RANK: Record<Rarity, RankId> = {
  common: 1,
  rare: 2,
  super_rare: 3,
  epic: 4,
  legendary: 5,
  super_legendary: 6,
}

export const RANK_TO_RARITY: Record<RankId, Rarity> = {
  1: 'common',
  2: 'rare',
  3: 'super_rare',
  4: 'epic',
  5: 'legendary',
  6: 'super_legendary',
}

export const SKILLS: { id: SkillId; name: string; blurb: string }[] = [
  { id: 'sharp', name: 'Pico afilado', blurb: '+12% Fuerza' },
  { id: 'swift', name: 'Paso ligero', blurb: '+12% Productividad' },
  { id: 'tank', name: 'Resistente', blurb: '+12% Resistencia' },
  { id: 'multi', name: 'Golpe doble', blurb: '+8% rate' },
  { id: 'reach', name: 'Brazo largo', blurb: '+5% rate' },
  { id: 'streak', name: 'Racha', blurb: '+8% rate total' },
  { id: 'luck', name: 'Fortuna', blurb: '+5% rate + dust al claim' },
]

export const SKILL_COUNT: Record<Rarity, number> = {
  common: 1,
  rare: 2,
  super_rare: 3,
  epic: 4,
  legendary: 5,
  super_legendary: 6,
}

type Weight = { rarity: Rarity; w: number }

export const BOXES: {
  id: BoxId
  name: string
  blurb: string
  priceMine: number
  /** IAP USD (plan monetización) */
  priceUsd: number
  priceLabel: string
  weights: Weight[]
}[] = [
  {
    id: 'common',
    name: 'Caja común',
    blurb: 'Entry · alta chance rank 1–2',
    priceMine: 40,
    priceUsd: 0.99,
    priceLabel: '$0.99 DEMO',
    weights: [
      { rarity: 'common', w: 82.87 },
      { rarity: 'rare', w: 10.36 },
      { rarity: 'super_rare', w: 5.18 },
      { rarity: 'epic', w: 1.4 },
      { rarity: 'legendary', w: 0.52 },
      { rarity: 'super_legendary', w: 0.04 },
    ],
  },
  {
    id: 'rare',
    name: 'Caja rara',
    blurb: 'Progresión · rank 2–4',
    priceMine: 180,
    priceUsd: 4.99,
    priceLabel: '$4.99 DEMO',
    weights: [
      { rarity: 'common', w: 2 },
      { rarity: 'rare', w: 80.5 },
      { rarity: 'super_rare', w: 12 },
      { rarity: 'epic', w: 4 },
      { rarity: 'legendary', w: 1 },
      { rarity: 'super_legendary', w: 0.5 },
    ],
  },
  {
    id: 'legendary',
    name: 'Caja legendaria',
    blurb: 'High ticket · rank 3–6',
    priceMine: 650,
    priceUsd: 14.99,
    priceLabel: '$14.99 DEMO',
    weights: [
      { rarity: 'common', w: 0 },
      { rarity: 'rare', w: 0 },
      { rarity: 'super_rare', w: 11 },
      { rarity: 'epic', w: 40 },
      { rarity: 'legendary', w: 41 },
      { rarity: 'super_legendary', w: 8 },
    ],
  },
]

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function pickWeighted(weights: Weight[]): Rarity {
  const total = weights.reduce((s, x) => s + x.w, 0)
  let r = Math.random() * total
  for (const row of weights) {
    r -= row.w
    if (r <= 0) return row.rarity
  }
  return weights[weights.length - 1].rarity
}

function rollSkills(rarity: Rarity): SkillId[] {
  const need = SKILL_COUNT[rarity]
  const pool = [...SKILLS.map((s) => s.id)]
  const out: SkillId[] = []
  while (out.length < need && pool.length) {
    const i = randInt(0, pool.length - 1)
    out.push(pool.splice(i, 1)[0])
  }
  return out
}

function statsFromRank(rank: number): MinerStats {
  const a = getRank(rank).attrs
  return {
    power: a.fuerza,
    speed: a.productividad,
    stamina: a.resistencia,
    hit: rank,
    range: 4 + rank * 2,
  }
}

export function rollRarityFromBox(boxId: BoxId): Rarity {
  const box = BOXES.find((b) => b.id === boxId)!
  return pickWeighted(box.weights.filter((w) => w.w > 0))
}

export function createMiner(rarity: Rarity, now = Date.now()): Miner {
  const rank = RARITY_TO_RANK[rarity]
  const def = getRank(rank)
  const maxEnergy = 100
  return {
    id: `m-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: def.name,
    rarity,
    skills: rollSkills(rarity),
    stats: statsFromRank(rank),
    level: rank,
    createdAt: now,
    energy: maxEnergy,
    maxEnergy,
  }
}

export function createStarterMiner(now = Date.now()): Miner {
  const m = createMiner('common', now)
  m.name = 'Minero Básico'
  m.skills = ['sharp']
  return m
}

export function displayAttrs(m: Miner) {
  const base = getRank(m.level).attrs
  let f = base.fuerza
  let r = base.resistencia
  let p = base.productividad
  for (const sk of m.skills) {
    if (sk === 'sharp') f = Math.round(f * 1.12)
    if (sk === 'swift') p = Math.round(p * 1.12)
    if (sk === 'tank') r = Math.round(r * 1.12)
  }
  return { fuerza: f, resistencia: r, productividad: p }
}

/** Compat: effectiveStats mirrors F/R/P into legacy fields */
export function effectiveStats(m: Miner): MinerStats {
  const a = displayAttrs(m)
  return {
    power: a.fuerza,
    speed: a.productividad,
    stamina: a.resistencia,
    hit: m.level,
    range: 4 + m.level * 2,
  }
}

export function minerHashRate(m: Miner): number {
  let mult = 1
  if (m.skills.includes('streak')) mult *= 1.08
  if (m.skills.includes('luck')) mult *= 1.05
  if (m.skills.includes('multi')) mult *= 1.08
  if (m.skills.includes('reach')) mult *= 1.05
  return rateFromAttrs(displayAttrs(m), mult)
}

export function upgradeMinerCost(level: number): number {
  return upgradeRankCost(level)
}

/** Sube un rank Dig (máx 6) y sincroniza nombre/rareza/stats */
export function applyMinerUpgrade(m: Miner): Miner {
  if (m.level >= MAX_RANK) return m
  const next = (m.level + 1) as RankId
  const def = getRank(next)
  return {
    ...m,
    level: next,
    name: def.name,
    rarity: RANK_TO_RARITY[next],
    stats: statsFromRank(next),
  }
}

export function skillName(id: SkillId): string {
  return SKILLS.find((s) => s.id === id)?.name ?? id
}

export { getRank, MAX_RANK, RANKS } from './ranks'
