/** Regalos operador Andres Medina — 2 cajas una vez (ambas Mítico max) */

import { PLAYER } from './brand'
import { createMiner, RANK_TO_RARITY, type Miner } from './miners'
import type { RankId } from './ranks'

export const OPERATOR_NAME = PLAYER

/** Gen 2 = ambas cajas rank 6 + hacha 6 (re-claim si reclamó gen 1 Élite/Mítico) */
export const OPERATOR_GIFTS_GEN = 2

export type OperatorGift = {
  id: 'gift_mythic_a' | 'gift_mythic_b'
  title: string
  blurb: string
  minerRank: RankId
  axeId: number
}

/** 2 cajas REGALO: ambas Mítico max (rank 6 / hacha 6) */
export const OPERATOR_GIFTS: OperatorGift[] = [
  {
    id: 'gift_mythic_a',
    title: 'Caja Mítica I',
    blurb: 'Minero Mítico (N6) + Hacha Legendaria',
    minerRank: 6,
    axeId: 6,
  },
  {
    id: 'gift_mythic_b',
    title: 'Caja Mítica II',
    blurb: 'Minero Mítico (N6) + Hacha Legendaria',
    minerRank: 6,
    axeId: 6,
  },
]

export function createGiftMiner(rank: RankId, now = Date.now(), slot = 0): Miner {
  const rarity = RANK_TO_RARITY[rank]
  const m = createMiner(rarity, now + rank + slot * 31)
  m.name = slot === 0 ? 'Andres · Mítico I' : 'Andres · Mítico II'
  m.skills = ['sharp', 'luck', 'streak']
  return m
}

export function isOperatorSession(name: string = OPERATOR_NAME): boolean {
  return name.trim().toLowerCase() === OPERATOR_NAME.toLowerCase()
}

/** True si ya reclamó la gen actual (ambas míticas) */
export function giftsFullyClaimed(claimed: boolean, gen: number): boolean {
  return claimed && gen >= OPERATOR_GIFTS_GEN
}
