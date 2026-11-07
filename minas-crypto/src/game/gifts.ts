/**
 * Regalos operador Andres Medina — 2 cajas una vez (ambas Mítico max).
 * Claim gated by /api/me/operator (Cursor identity email allowlist) — NOT by PLAYER brand.
 */

import { PLAYER } from './brand'
import {
  GIFT_CORE_ATTRS,
  createMiner,
  isOperatorGiftMiner,
  RANK_TO_RARITY,
  type Miner,
} from './miners'
import type { RankId } from './ranks'
import type { GameState } from './types'

export { GIFT_CORE_ATTRS }
/** Display name only — never use as auth for gifts */
export const OPERATOR_NAME = PLAYER

/** Gen 2 = ambas cajas rank 6 + hacha 6 */
export const OPERATOR_GIFTS_GEN = 2

export const MAX_MINERS_COLLECTION = 10

export type OperatorGift = {
  id: 'gift_mythic_a' | 'gift_mythic_b'
  title: string
  blurb: string
  minerRank: RankId
  axeId: number
}

/** 2 cajas REGALO: ambas Mítico max (rank 6 / hacha 6) + cores 150 */
export const OPERATOR_GIFTS: OperatorGift[] = [
  {
    id: 'gift_mythic_a',
    title: 'Caja Mítica I',
    blurb: 'Minero Mítico 150 F/R/P + Hacha Legendaria',
    minerRank: 6,
    axeId: 6,
  },
  {
    id: 'gift_mythic_b',
    title: 'Caja Mítica II',
    blurb: 'Minero Mítico 150 F/R/P + Hacha Legendaria',
    minerRank: 6,
    axeId: 6,
  },
]

export function giftDisplayName(slot: number): string {
  return slot === 0 ? 'Minero Mítico I' : 'Minero Mítico II'
}

export function stampGiftCores(m: Miner, slot = 0): Miner {
  return {
    ...m,
    level: 6,
    rarity: RANK_TO_RARITY[6],
    name: giftDisplayName(slot),
    operatorGift: true,
    coreAttrs: { ...GIFT_CORE_ATTRS },
    stats: {
      power: GIFT_CORE_ATTRS.fuerza,
      speed: GIFT_CORE_ATTRS.productividad,
      stamina: GIFT_CORE_ATTRS.resistencia,
      hit: 6,
      range: 4 + 6 * 2,
    },
    skills: m.skills?.length ? m.skills : ['sharp', 'luck', 'streak'],
  }
}

export function createGiftMiner(_rank: RankId = 6, now = Date.now(), slot = 0): Miner {
  const m = createMiner(RANK_TO_RARITY[6], now + 6 + slot * 97)
  m.skills = ['sharp', 'luck', 'streak']
  return stampGiftCores(m, slot)
}

/**
 * @deprecated Brand-name check is NOT authorization.
 * Use fetchOperatorStatus() / operatorAuthorized flag from /api/me/operator.
 * Kept returning false so accidental call sites never auto-grant gifts.
 */
export function isOperatorSession(_name?: string): boolean {
  return false
}

export function isGiftMiner(m: Miner): boolean {
  return isOperatorGiftMiner(m)
}

export function giftsFullyClaimed(claimed: boolean, gen: number): boolean {
  return claimed && gen >= OPERATOR_GIFTS_GEN
}

export function countGiftMiners(miners: Miner[]): number {
  return miners.filter(isGiftMiner).length
}

function giftCoresOk(m: Miner): boolean {
  return (
    !!m.operatorGift &&
    !!m.coreAttrs &&
    m.coreAttrs.fuerza >= GIFT_CORE_ATTRS.fuerza &&
    m.coreAttrs.resistencia >= GIFT_CORE_ATTRS.resistencia &&
    m.coreAttrs.productividad >= GIFT_CORE_ATTRS.productividad &&
    /^Minero Mítico/i.test(m.name)
  )
}

/** Solo ids que existen en el roster — evita cupo fantasma que bloquea Desplegar */
export function sanitizeDeployedIds(
  deployedIds: string[] | undefined,
  miners: Miner[],
  max = MAX_MINERS_COLLECTION,
): string[] {
  const valid = new Set(miners.map((m) => m.id))
  const out: string[] = []
  for (const id of deployedIds ?? []) {
    if (!valid.has(id) || out.includes(id)) continue
    out.push(id)
    if (out.length >= max) break
  }
  if (out.length === 0 && miners.length > 0) {
    return miners.slice(0, Math.min(max, miners.length)).map((m) => m.id)
  }
  return out
}

/**
 * Claim incompleto, cores viejos (112), nombre "Minero Legendario", o sin hacha 6.
 * También true si claimed y hay N6 huérfanos a adoptar.
 */
/**
 * Repair only when this save already claimed gifts (localStorage).
 * Never auto-claim for visitors — identity gate is enforced at claim time.
 */
export function needsOperatorGiftRepair(
  state: Pick<GameState, 'operatorGiftsClaimed' | 'operatorGiftsGen' | 'miners' | 'ownedAxes'>,
): boolean {
  const claimed = state.operatorGiftsClaimed || (state.operatorGiftsGen ?? 0) >= 2
  if (!claimed) return false
  const gifts = state.miners.filter(isGiftMiner)
  if (gifts.length < 2) return true
  if (!(state.ownedAxes ?? []).includes(6)) return true
  if (gifts.some((m) => !giftCoresOk(m))) return true
  return false
}

/** N6 legacy del claim (nombre Dig "Minero Legendario") a promover a regalo */
function legacyMythicCandidates(miners: Miner[]): Miner[] {
  return miners
    .filter(
      (m) =>
        !isGiftMiner(m) &&
        (m.level >= 6 || m.rarity === 'super_legendary' || /^Minero Legendario/i.test(m.name)),
    )
    .sort((a, b) => b.createdAt - a.createdAt || b.level - a.level)
}

/**
 * Aplica/repara las 2 cajas míticas (sin wipe).
 * Adopta N6 "Minero Legendario" del claim viejo → Minero Mítico 150 + deploy limpio.
 */
export function applyOperatorGifts(state: GameState, now = Date.now()): GameState {
  let miners = state.miners.map((m) => ({ ...m }))
  let gifts = miners.filter(isGiftMiner)

  // Adoptar míticos legacy del claim anterior (sin flag / sin Andres name)
  if (gifts.length < OPERATOR_GIFTS.length) {
    const need = OPERATOR_GIFTS.length - gifts.length
    const adoptIds = new Set(legacyMythicCandidates(miners).slice(0, need).map((m) => m.id))
    miners = miners.map((m) => {
      if (!adoptIds.has(m.id)) return m
      return { ...m, operatorGift: true, name: m.name.startsWith('Andres') ? m.name : 'Minero Mítico' }
    })
    gifts = miners.filter(isGiftMiner)
  }

  const needCreate = Math.max(0, OPERATOR_GIFTS.length - gifts.length)
  const giftedNew: Miner[] = []
  for (let i = 0; i < needCreate; i++) {
    giftedNew.push(createGiftMiner(6, now + i * 17, gifts.length + i))
  }

  const room = Math.max(0, MAX_MINERS_COLLECTION - miners.length)
  if (giftedNew.length > room) {
    const needDrop = giftedNew.length - room
    const droppable = miners
      .filter((m) => !isGiftMiner(m))
      .sort((a, b) => a.level - b.level || a.createdAt - b.createdAt)
    const drop = new Set(droppable.slice(0, needDrop).map((m) => m.id))
    miners = miners.filter((m) => !drop.has(m.id))
  }
  miners = [...miners, ...giftedNew].slice(0, MAX_MINERS_COLLECTION)

  // Stamp cores 150 + nombre Mítico I/II en todos los regalos
  let giftSlot = 0
  miners = miners.map((m) => {
    if (!isGiftMiner(m)) return m
    const stamped = stampGiftCores(m, giftSlot)
    giftSlot += 1
    return stamped
  })

  const allGiftIds = miners.filter(isGiftMiner).map((m) => m.id)
  const ownedAxes = [...new Set([...(state.ownedAxes ?? [1]), 6])]
    .filter((n) => n >= 1 && n <= 6)
    .sort((a, b) => a - b)

  const preferred = [
    ...allGiftIds,
    ...(state.deployedMinerIds ?? []).filter((id) => !allGiftIds.includes(id)),
  ]
  const deployedMinerIds = sanitizeDeployedIds(preferred, miners, MAX_MINERS_COLLECTION)

  return {
    ...state,
    miners,
    deployedMinerIds,
    activeMinerId: allGiftIds[allGiftIds.length - 1] ?? state.activeMinerId,
    ownedAxes,
    equippedAxeId: 6,
    operatorGiftsClaimed: true,
    operatorGiftsGen: OPERATOR_GIFTS_GEN,
  }
}

/** Prioriza regalos en deploy + limpia stale */
export function ensureGiftsDeployable(state: GameState): GameState {
  const giftIds = state.miners.filter(isGiftMiner).map((m) => m.id)
  if (giftIds.length === 0) {
    return { ...state, deployedMinerIds: sanitizeDeployedIds(state.deployedMinerIds, state.miners) }
  }
  const preferred = [
    ...giftIds,
    ...(state.deployedMinerIds ?? []).filter((id) => !giftIds.includes(id)),
  ]
  return {
    ...state,
    deployedMinerIds: sanitizeDeployedIds(preferred, state.miners),
    ownedAxes: [...new Set([...(state.ownedAxes ?? [1]), 6])]
      .filter((n) => n >= 1 && n <= 6)
      .sort((a, b) => a - b),
  }
}
