/** Regalos operador Andres Medina — 2 cajas una vez */

import { PLAYER } from './brand'
import { createMiner, RANK_TO_RARITY, type Miner } from './miners'
import type { RankId } from './ranks'

export const OPERATOR_NAME = PLAYER

export type OperatorGift = {
  id: 'gift_elite' | 'gift_mythic'
  title: string
  blurb: string
  minerRank: RankId
  axeId: number
}

/** 2 cajas regalo: minero+hacha fuertes (rank/hacha 5–6) */
export const OPERATOR_GIFTS: OperatorGift[] = [
  {
    id: 'gift_elite',
    title: 'Caja Élite',
    blurb: 'Minero Élite (N5) + Hacha Élite',
    minerRank: 5,
    axeId: 5,
  },
  {
    id: 'gift_mythic',
    title: 'Caja Mítica',
    blurb: 'Minero Legendario (N6) + Hacha Legendaria',
    minerRank: 6,
    axeId: 6,
  },
]

export function createGiftMiner(rank: RankId, now = Date.now()): Miner {
  const rarity = RANK_TO_RARITY[rank]
  const m = createMiner(rarity, now + rank)
  m.name = rank >= 6 ? 'Andres · Mítico' : 'Andres · Élite'
  m.skills = rank >= 6 ? ['sharp', 'luck', 'streak'] : ['sharp', 'multi']
  return m
}

export function isOperatorSession(name: string = OPERATOR_NAME): boolean {
  return name.trim().toLowerCase() === OPERATOR_NAME.toLowerCase()
}
