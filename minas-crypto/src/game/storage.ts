import { dayKey } from './economy'
import { MAX_ENERGY } from './energy'
import {
  applyOperatorGifts,
  ensureGiftsDeployable,
  giftsFullyClaimed,
  needsOperatorGiftRepair,
  sanitizeDeployedIds,
} from './gifts'
import { createMineField, normalizeMineBlocks } from './mineField'
import { createStarterMiner, type Miner } from './miners'
import { makeReferralCode } from './referrals'
import { weekKey } from './ranking'
import { SEASON, type SkinId } from './season'
import type { DailyCounters, GameState, ReferralState, SeasonState } from './types'

function normalizeMiner(m: Miner): Miner {
  const maxEnergy = typeof m.maxEnergy === 'number' && m.maxEnergy > 0 ? m.maxEnergy : MAX_ENERGY
  const energy = typeof m.energy === 'number' ? Math.min(maxEnergy, Math.max(0, m.energy)) : maxEnergy
  return { ...m, maxEnergy, energy }
}

const KEY = 'cava-idle-mvp-v10'

function defaultReferral(now = Date.now()): ReferralState {
  return {
    code: makeReferralCode(`andres-${now}`),
    invited: 0,
    redeemedCodes: [],
    usedInvite: null,
  }
}

function defaultSeason(): SeasonState {
  return {
    seasonId: SEASON.id,
    xp: 0,
    premium: false,
    claimedFree: [],
    claimedPremium: [],
    ownedSkins: ['default'],
    equippedSkin: 'default',
  }
}

export function emptyDaily(now = Date.now()): DailyCounters {
  return {
    day: dayKey(now),
    adsTotal: 0,
    adsByType: {},
    claims: 0,
    claimTimestamps: [],
    withdrawCount: 0,
    withdrawAmount: 0,
    megaBought: false,
    iapStarterBought: false,
    boxesOpened: 0,
    referralsRedeemed: 0,
  }
}

export function defaultState(now = Date.now()): GameState {
  const starter = createStarterMiner(now)
  return {
    balance: 2500,
    pending: 5.25,
    withdrawn: 0,
    levels: { pickaxe: 0, rig: 0, power: 0 },
    miners: [starter],
    activeMinerId: starter.id,
    deployedMinerIds: [starter.id],
    mineBlocks: createMineField(),
    minedTotal: 0,
    ownedAxes: [1],
    equippedAxeId: 1,
    lastTickAt: now,
    lastMineTickAt: now,
    lastOnlineAt: now,
    lastClaimAt: 0,
    lastWithdrawAt: 0,
    lastAdAt: 0,
    boost: null,
    skipClaimCooldown: false,
    history: [],
    totalClaimed: 0,
    daily: emptyDaily(now),
    sessionStartedAt: now,
    lastBoxId: null,
    referral: defaultReferral(now),
    season: defaultSeason(),
    weekMined: 0,
    weekKey: weekKey(now),
    operatorGiftsClaimed: false,
    operatorGiftsGen: 0,
  }
}

export function loadState(): GameState {
  try {
    const raw =
      localStorage.getItem(KEY) ??
      localStorage.getItem('cava-idle-mvp-v9') ??
      localStorage.getItem('cava-idle-mvp-v8') ??
      localStorage.getItem('cava-idle-mvp-v7') ??
      localStorage.getItem('cava-idle-mvp-v6') ??
      localStorage.getItem('cava-idle-mvp-v5')
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<GameState>
    const now = Date.now()
    const base = defaultState(now)
    const daily =
      parsed.daily && parsed.daily.day === dayKey(now) ? { ...emptyDaily(now), ...parsed.daily } : emptyDaily(now)
    const miners = (
      Array.isArray(parsed.miners) && parsed.miners.length > 0 ? parsed.miners.slice(0, 10) : base.miners
    ).map((m) => normalizeMiner(m as Miner))
    const activeMinerId =
      parsed.activeMinerId && miners.some((m) => m.id === parsed.activeMinerId)
        ? parsed.activeMinerId
        : miners[0]?.id ?? null
    const deployedMinerIds = sanitizeDeployedIds(
      Array.isArray(parsed.deployedMinerIds) ? parsed.deployedMinerIds : undefined,
      miners,
    )
    const ownedAxes =
      Array.isArray(parsed.ownedAxes) && parsed.ownedAxes.length > 0
        ? [...new Set(parsed.ownedAxes.map(Number))].filter((n) => n >= 1 && n <= 6)
        : [1]
    const equippedAxeId =
      parsed.equippedAxeId && ownedAxes.includes(Number(parsed.equippedAxeId))
        ? Number(parsed.equippedAxeId)
        : ownedAxes[0]
    const mineBlocks = normalizeMineBlocks(parsed.mineBlocks)
    const wk = weekKey(now)
    const weekMined = parsed.weekKey === wk && typeof parsed.weekMined === 'number' ? parsed.weekMined : 0
    const referral: ReferralState = {
      ...defaultReferral(now),
      ...(parsed.referral ?? {}),
      code: parsed.referral?.code || makeReferralCode(miners[0]?.id ?? `cava-${now}`),
      redeemedCodes: Array.isArray(parsed.referral?.redeemedCodes) ? parsed.referral!.redeemedCodes : [],
    }
    const seasonRaw = parsed.season
    const ownedSkins = (
      Array.isArray(seasonRaw?.ownedSkins) && seasonRaw!.ownedSkins.length
        ? seasonRaw!.ownedSkins
        : (['default'] as SkinId[])
    ) as SkinId[]
    const season: SeasonState = {
      ...defaultSeason(),
      ...(seasonRaw ?? {}),
      seasonId: SEASON.id,
      ownedSkins: ownedSkins.includes('default') ? ownedSkins : (['default', ...ownedSkins] as SkinId[]),
      equippedSkin: (ownedSkins.includes(seasonRaw?.equippedSkin as SkinId)
        ? seasonRaw!.equippedSkin
        : 'default') as SkinId,
      claimedFree: Array.isArray(seasonRaw?.claimedFree) ? seasonRaw!.claimedFree : [],
      claimedPremium: Array.isArray(seasonRaw?.claimedPremium) ? seasonRaw!.claimedPremium : [],
    }
    let state: GameState = {
      ...base,
      ...parsed,
      levels: {
        pickaxe: parsed.levels?.pickaxe ?? 0,
        rig: parsed.levels?.rig ?? 0,
        power: parsed.levels?.power ?? 0,
      },
      miners,
      activeMinerId,
      deployedMinerIds,
      mineBlocks,
      minedTotal: typeof parsed.minedTotal === 'number' ? parsed.minedTotal : 0,
      ownedAxes,
      equippedAxeId,
      lastMineTickAt: parsed.lastMineTickAt ?? now,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 50) : [],
      daily: { ...daily, referralsRedeemed: daily.referralsRedeemed ?? 0 },
      sessionStartedAt: now,
      referral,
      season,
      weekMined,
      weekKey: wk,
      operatorGiftsGen: Number(parsed.operatorGiftsGen) || 0,
      operatorGiftsClaimed: Boolean(parsed.operatorGiftsClaimed),
    }

    // Si ya reclamó (gen≥2): siempre re-stamp 150 + nombre Mítico + deploy limpio (sin wipe)
    if (state.operatorGiftsClaimed || (state.operatorGiftsGen ?? 0) >= 2 || needsOperatorGiftRepair(state)) {
      state = applyOperatorGifts(state, now)
    } else {
      state = ensureGiftsDeployable(state)
      state = {
        ...state,
        operatorGiftsClaimed: giftsFullyClaimed(state.operatorGiftsClaimed, state.operatorGiftsGen ?? 0),
      }
    }
    return state
  } catch {
    return defaultState()
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}
