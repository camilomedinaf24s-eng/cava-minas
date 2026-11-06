/** Economía alineada con docs/economia-mvp.md */

export { TOKEN, PLAYER, BRAND, BRAND_SUB } from './brand'

export const BASE_RATE_PER_HOUR = 12
export const TICK_MS = 250

export const ONLINE_CAP_HOURS = 8
export const OFFLINE_CAP_HOURS_BASE = 6
export const WALLET_SOFT_CAP = 50_000

export const CLAIM_MIN_AMOUNT = 5
export const CLAIM_MIN_MINUTES = 10
export const CLAIM_COOLDOWN_MS = 5 * 60_000
export const MAX_CLAIMS_PER_HOUR = 8
export const MAX_CLAIMS_PER_DAY = 40

export const WITHDRAW_MIN = 100
export const WITHDRAW_MAX_PER_DAY = 5_000
export const WITHDRAW_MAX_COUNT_PER_DAY = 2
export const WITHDRAW_COOLDOWN_MS = 24 * 3600_000

export const AD_COOLDOWN_MS = 90_000
export const AD_TOTAL_PER_DAY = 15
export const AD_SIM_DURATION_MS = 5_000

export type UpgradeLine = 'pickaxe' | 'rig' | 'power'

export type UpgradeDef = {
  id: UpgradeLine
  name: string
  blurb: string
  baseCost: number
  growth: number
  maxLevel: number
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'pickaxe',
    name: 'Pickaxe',
    blurb: 'Sube el hash rate base del filón.',
    baseCost: 25,
    growth: 1.6,
    maxLevel: 25,
  },
  {
    id: 'rig',
    name: 'Rig',
    blurb: 'Multiplicador permanente compuesto ×1.10.',
    baseCost: 100,
    growth: 1.8,
    maxLevel: 15,
  },
  {
    id: 'power',
    name: 'Power',
    blurb: 'Más cap offline y mejor decay AFK.',
    baseCost: 50,
    growth: 1.7,
    maxLevel: 10,
  },
]

export function upgradeCost(def: UpgradeDef, currentLevel: number): number {
  // n = próximo nivel (1 = primera compra)
  return Math.floor(def.baseCost * Math.pow(def.growth, currentLevel))
}

/** Bonus pickaxe del nivel n (1-indexed), alineado a la tabla del doc. */
export function pickaxeBonusAt(n: number): number {
  if (n <= 0) return 0
  const table: Record<number, number> = {
    1: 3, 2: 3, 3: 4, 4: 4, 5: 5, 6: 5, 7: 6, 8: 6, 9: 7, 10: 8,
  }
  if (n <= 10) return table[n]
  if (n <= 15) return Math.round(8 + (n - 10) * 0.8) // n15 → 12
  if (n <= 20) return Math.round(12 + (n - 15) * 1.2) // n20 → 18
  return Math.round(18 + (n - 20) * 1.2)
}

export function sumPickaxeBonuses(level: number): number {
  let sum = 0
  for (let n = 1; n <= level; n++) sum += pickaxeBonusAt(n)
  return sum
}

export function rigMultiplier(level: number): number {
  return Math.pow(1.1, level)
}

export type CapProfile = {
  offlineCapHours: number
  onlineCapHours: number
  decay13: number
  decay36: number
}

export function powerProfile(level: number): CapProfile {
  // Base
  let offlineCapHours = OFFLINE_CAP_HOURS_BASE
  let onlineCapHours = ONLINE_CAP_HOURS
  let decay13 = 0.8
  let decay36 = 0.5

  // Level effects cumulative per doc
  if (level >= 1) offlineCapHours = 6.5
  if (level >= 2) offlineCapHours = 7.0
  if (level >= 3) onlineCapHours = 9
  if (level >= 5) decay13 = 0.9
  if (level >= 8) {
    offlineCapHours = 8
    decay36 = 0.65
  }
  if (level >= 10) offlineCapHours = 10

  return { offlineCapHours, onlineCapHours, decay13, decay36 }
}

export function baseHashRate(pickaxeLevel: number): number {
  return BASE_RATE_PER_HOUR + sumPickaxeBonuses(pickaxeLevel)
}

export function effectiveRate(
  pickaxeLevel: number,
  rigLevel: number,
  boostMultiplier: number,
): number {
  return baseHashRate(pickaxeLevel) * rigMultiplier(rigLevel) * boostMultiplier
}

/** Offline yield with tiered decay (hours). */
export function offlineYieldHours(
  ratePerHour: number,
  hoursOffline: number,
  profile: CapProfile,
): number {
  const t = Math.min(Math.max(hoursOffline, 0), profile.offlineCapHours)
  const h1 = Math.min(t, 1)
  const h13 = Math.max(0, Math.min(t, 3) - 1)
  const h36 = Math.max(0, Math.min(t, Math.min(6, profile.offlineCapHours)) - 3)
  // Beyond 6h up to extended cap: use decay36 rate as mild continuation when power>=8
  const hExtra = profile.offlineCapHours > 6 ? Math.max(0, t - 6) : 0
  return (
    ratePerHour * h1 * 1.0 +
    ratePerHour * h13 * profile.decay13 +
    ratePerHour * h36 * profile.decay36 +
    ratePerHour * hExtra * profile.decay36
  )
}

export type AdRewardId = 'boost2' | 'boost3' | 'instant' | 'pack' | 'chest'

export type AdRewardDef = {
  id: AdRewardId
  name: string
  blurb: string
  dailyLimit: number
  kind: 'boost' | 'instant' | 'pack' | 'chest'
  multiplier?: number
  durationMs?: number
}

export const AD_REWARDS: AdRewardDef[] = [
  {
    id: 'boost2',
    name: 'Boost ×2',
    blurb: 'Duplica el rate por 15 minutos.',
    dailyLimit: 8,
    kind: 'boost',
    multiplier: 2,
    durationMs: 15 * 60_000,
  },
  {
    id: 'boost3',
    name: 'Boost ×3',
    blurb: 'Triplica el rate por 5 minutos.',
    dailyLimit: 3,
    kind: 'boost',
    multiplier: 3,
    durationMs: 5 * 60_000,
  },
  {
    id: 'instant',
    name: 'Claim instantáneo',
    blurb: 'Salta el cooldown de claim (sigue el mínimo).',
    dailyLimit: 5,
    kind: 'instant',
  },
  {
    id: 'pack',
    name: 'Pack de mineral',
    blurb: '+15 min de producción al rate actual.',
    dailyLimit: 4,
    kind: 'pack',
  },
  {
    id: 'chest',
    name: 'Lucky chest',
    blurb: '10–40 MINE al azar.',
    dailyLimit: 2,
    kind: 'chest',
  },
]

export type IapSku =
  | 'starter'
  | 'boost2h'
  | 'boost5'
  | 'mega'
  | 'minerBundle'

export type IapDef = {
  id: IapSku
  name: string
  price: string
  blurb: string
}

export const IAP_PACKS: IapDef[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    price: '$4.99',
    blurb: 'Caja rara + ⚡ Medio · primera compra',
  },
  {
    id: 'boost2h',
    name: 'Boost ×2 (2 h)',
    price: '$1.99',
    blurb: 'Multiplicador ×2 durante 2 horas.',
  },
  {
    id: 'boost5',
    name: 'Boost ×5 (1 h)',
    price: '$4.99',
    blurb: 'Multiplicador ×5 durante 1 hora.',
  },
  {
    id: 'mega',
    name: 'Mega Shift ×10',
    price: '$9.99',
    blurb: '×10 por 30 min · 1 / día',
  },
  {
    id: 'minerBundle',
    name: 'Miner Bundle',
    price: '$7.99',
    blurb: '1 000 MINE + ×2 / 4 h + Power +1',
  },
]

/** Formato precio IAP USD */
export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

export function dayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

export function formatMine(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '0.00'
  if (Math.abs(n) >= 1000) return n.toLocaleString('es-ES', { maximumFractionDigits: 1 })
  return n.toFixed(digits)
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}h ${mm.toString().padStart(2, '0')}m`
  }
  return `${m}:${r.toString().padStart(2, '0')}`
}
