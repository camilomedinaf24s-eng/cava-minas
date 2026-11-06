import type { AdRewardId } from './economy'
import type { MineBlock } from './mineField'
import type { BoxId, Miner } from './miners'
import type { SkinId } from './season'

export type ClaimRecord = {
  id: string
  at: number
  amount: number
  kind:
    | 'claim'
    | 'withdraw'
    | 'ad'
    | 'iap'
    | 'box'
    | 'upgrade_miner'
    | 'axe'
    | 'mine'
    | 'energy'
    | 'referral'
    | 'season'
  note?: string
}

export type ActiveBoost = {
  source: string
  multiplier: number
  endsAt: number
}

export type DailyCounters = {
  day: string
  adsTotal: number
  adsByType: Partial<Record<AdRewardId, number>>
  claims: number
  claimTimestamps: number[]
  withdrawCount: number
  withdrawAmount: number
  megaBought: boolean
  iapStarterBought: boolean
  boxesOpened: number
  referralsRedeemed: number
}

export type ReferralState = {
  code: string
  invited: number
  redeemedCodes: string[]
  /** Si este jugador ya canjeó un código de otro */
  usedInvite: string | null
}

export type SeasonState = {
  seasonId: string
  xp: number
  premium: boolean
  claimedFree: number[]
  claimedPremium: number[]
  ownedSkins: SkinId[]
  equippedSkin: SkinId
}

export type GameState = {
  balance: number
  pending: number
  withdrawn: number
  levels: {
    pickaxe: number
    rig: number
    power: number
  }
  miners: Miner[]
  activeMinerId: string | null
  /** Mineros desplegados en el mapa (máx 10). Vacío = todos hasta 10. */
  deployedMinerIds: string[]
  /** Bloques del mapa de minas */
  mineBlocks: MineBlock[]
  /** Total MINE ganado rompiendo bloques (DEMO) */
  minedTotal: number
  /** Hachas desbloqueadas (ids 1..6) */
  ownedAxes: number[]
  equippedAxeId: number
  lastTickAt: number
  lastMineTickAt: number
  lastOnlineAt: number
  lastClaimAt: number
  lastWithdrawAt: number
  lastAdAt: number
  boost: ActiveBoost | null
  skipClaimCooldown: boolean
  history: ClaimRecord[]
  totalClaimed: number
  daily: DailyCounters
  sessionStartedAt: number
  lastBoxId: BoxId | null
  referral: ReferralState
  season: SeasonState
  /** MINE minado esta semana (ranking) */
  weekMined: number
  weekKey: string
}
