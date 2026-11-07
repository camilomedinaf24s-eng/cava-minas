/** Energía / estamina de mineros (CAVA DEMO) */

export const MAX_ENERGY = 100
/** Drain por segundo mientras pica */
export const ENERGY_DRAIN_PER_SEC = 7.5
/** Mult. de caminata si energy === 0 */
export const TIRED_WALK_MULT = 0.32

export type EnergyPackId = 'basic' | 'medium' | 'large'

export type EnergyPack = {
  id: EnergyPackId
  name: string
  symbol: string
  blurb: string
  /** Soft currency (opcional) */
  priceMine: number
  /** IAP USD (plan monetización) */
  priceUsd: number
  /** Cap de estamina tras comprar (más = más duración picando) */
  maxEnergy: number
  bolts: number
  tier: 'basic' | 'medium' | 'large'
}

/** 3 packs ⚡ — floors ≥ NOWPayments USDT min (~$9 TRC20) */
export const ENERGY_PACKS: EnergyPack[] = [
  {
    id: 'basic',
    name: 'Básico',
    symbol: '⚡',
    blurb: 'Recarga crew a 100. Alto volumen.',
    priceMine: 30,
    priceUsd: 9.99,
    maxEnergy: 100,
    bolts: 1,
    tier: 'basic',
  },
  {
    id: 'medium',
    name: 'Medio',
    symbol: '⚡',
    blurb: 'Recarga a 180. Mejor valor.',
    priceMine: 90,
    priceUsd: 14.99,
    maxEnergy: 180,
    bolts: 2,
    tier: 'medium',
  },
  {
    id: 'large',
    name: 'Grande',
    symbol: '⚡',
    blurb: 'Recarga a 320. Sesión larga.',
    priceMine: 220,
    priceUsd: 19.99,
    maxEnergy: 320,
    bolts: 3,
    tier: 'large',
  },
]

/** Alias pack Básico (compat) */
export const ENERGY_ITEM = ENERGY_PACKS[0]

export function getEnergyPack(id: EnergyPackId): EnergyPack {
  return ENERGY_PACKS.find((p) => p.id === id) ?? ENERGY_PACKS[0]
}

export function defaultEnergy(max = MAX_ENERGY): { energy: number; maxEnergy: number } {
  return { energy: max, maxEnergy: max }
}

export function isTired(energy: number): boolean {
  return energy <= 0
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`
}
