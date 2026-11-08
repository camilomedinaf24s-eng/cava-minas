import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AD_COOLDOWN_MS,
  AD_REWARDS,
  AD_TOTAL_PER_DAY,
  CLAIM_COOLDOWN_MS,
  CLAIM_MIN_AMOUNT,
  CLAIM_MIN_MINUTES,
  MAX_CLAIMS_PER_DAY,
  MAX_CLAIMS_PER_HOUR,
  TICK_MS,
  TOKEN,
  UPGRADES,
  WITHDRAW_COOLDOWN_MS,
  WITHDRAW_MAX_COUNT_PER_DAY,
  WITHDRAW_MAX_PER_DAY,
  baseHashRate,
  dayKey,
  offlineYieldHours,
  powerProfile,
  rigMultiplier,
  upgradeCost,
  type AdRewardId,
  type IapSku,
} from './economy'
import { playBreak, playPickHit } from './audio'
import { axeRateMult, getAxe } from './axes'
import {
  ENERGY_DRAIN_PER_SEC,
  ENERGY_ITEM,
  ENERGY_PACKS,
  formatUsd,
  getEnergyPack,
  MAX_ENERGY,
  TIRED_WALK_MULT,
  type EnergyPackId,
} from './energy'
import {
  MAX_REFERRALS,
  REFERRAL_REWARD_BOX,
  REFERRAL_REWARD_MINE,
  isValidReferralCode,
} from './referrals'
import { monthKey, prizeForPlace, weekKey, type MonthlyPrizePlace } from './ranking'
import {
  SEASON,
  SEASON_TRACK,
  SKINS,
  seasonTierFromXp,
  type SkinId,
} from './season'
import {
  completeMockCheckout,
  createMockCheckout,
  type StripeProductId,
} from './stripeMock'
import {
  MAX_MINERS,
  damageFromRate,
  mineTick,
  type BreakEvent,
  type MinerAgent,
} from './mineField'
import {
  BOXES,
  applyMinerUpgrade,
  createMiner,
  minerHashRate,
  rollRarityFromBox,
  upgradeMinerCost,
  type BoxId,
  type Miner,
} from './miners'
import {
  applyOperatorGifts,
  giftsFullyClaimed,
  sanitizeDeployedIds,
} from './gifts'
import { defaultState, emptyDaily, loadState, saveState, settleMonthIfNeeded } from './storage'
import type { ClaimRecord, GameState } from './types'

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function ensureDaily(state: GameState, now: number): GameState {
  if (state.daily.day === dayKey(now)) return state
  return { ...state, daily: emptyDaily(now) }
}

function boostMult(state: GameState, now: number): number {
  if (state.boost && state.boost.endsAt > now) return state.boost.multiplier
  return 1
}

function activeMiner(state: GameState): Miner | null {
  if (!state.activeMinerId) return state.miners[0] ?? null
  return state.miners.find((m) => m.id === state.activeMinerId) ?? state.miners[0] ?? null
}

export function deployedMiners(state: GameState): Miner[] {
  const ids =
    state.deployedMinerIds?.length > 0
      ? state.deployedMinerIds
      : state.miners.map((m) => m.id)
  const set = new Set(ids.slice(0, MAX_MINERS))
  return state.miners.filter((m) => set.has(m.id)).slice(0, MAX_MINERS)
}

/**
 * Rate efectivo (todos los desplegados, máx 10):
 *   Σ minerHashRate × axe × rig + pick flat × boost
 */
export function computeRate(state: GameState, now: number): number {
  const crew = deployedMiners(state)
  const axe = getAxe(state.equippedAxeId ?? 1)
  const axeM = axeRateMult(axe)
  const minerRate = crew.reduce((s, m) => s + minerHashRate(m) * axeM, 0)
  const pickFlat = baseHashRate(state.levels.pickaxe) - 12
  const combined = minerRate + Math.max(0, pickFlat)
  return combined * rigMultiplier(state.levels.rig) * boostMult(state, now)
}

function accrue(state: GameState, now: number): GameState {
  const minersCount = (state.deployedMinerIds?.length || state.miners.length || 1)
  let s = settleMonthIfNeeded(ensureDaily(state, now), now, minersCount)
  const elapsedMs = Math.max(0, now - s.lastTickAt)
  if (elapsedMs < 50) return s

  let boost = s.boost
  if (boost && boost.endsAt <= now) boost = null
  s = { ...s, boost }

  const profile = powerProfile(s.levels.power)
  const rate = computeRate(s, now)
  const gapSec = elapsedMs / 1000
  let gained = 0

  if (gapSec > 45) {
    gained = offlineYieldHours(rate, elapsedMs / 3600_000, profile)
  } else {
    const pendingHours = rate > 0 ? s.pending / rate : 0
    const roomHours = Math.max(0, profile.onlineCapHours - pendingHours)
    const addHours = Math.min(elapsedMs / 3600_000, roomHours)
    gained = rate * addHours
  }

  return { ...s, pending: s.pending + gained, lastTickAt: now, lastOnlineAt: now }
}

function pushHistory(state: GameState, record: ClaimRecord): ClaimRecord[] {
  return [record, ...state.history].slice(0, 50)
}

export function useGame() {
  const [state, setState] = useState<GameState>(() => loadState())
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState<string | null>(null)
  const [opening, setOpening] = useState<{ boxId: BoxId; miner: Miner } | null>(null)
  const [floaters, setFloaters] = useState<
    { id: string; col: number; row: number; text: string; at: number }[]
  >([])
  const [agents, setAgents] = useState<MinerAgent[]>([])
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  useEffect(() => {
    setState((s) => {
      const next = accrue(s, Date.now())
      saveState(next)
      return next
    })
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      setState((s) => {
        let next = accrue(s, t)
        const crew = deployedMiners(next)
        const elapsed = Math.max(0, (t - (next.lastMineTickAt || t)) / 1000)
        if (crew.length > 0 && elapsed >= 0.05) {
          const rate = computeRate(next, t)
          const tickDt = Math.min(elapsed, 0.35)
          const dmg = damageFromRate(rate, tickDt, crew.length)
          const energyByMiner: Record<string, number> = {}
          for (const m of next.miners) energyByMiner[m.id] = m.energy ?? MAX_ENERGY
          const result = mineTick(
            next.mineBlocks ?? [],
            agentsRef.current,
            crew.map((m) => m.id),
            dmg,
            t,
            tickDt,
            energyByMiner,
            4500,
            TIRED_WALK_MULT,
          )
          setAgents(result.agents)
          agentsRef.current = result.agents

          const drainMap = new Map<string, number>()
          for (const d of result.drains) {
            drainMap.set(d.minerId, (drainMap.get(d.minerId) ?? 0) + d.amount * ENERGY_DRAIN_PER_SEC)
          }
          let miners = next.miners
          if (drainMap.size) {
            miners = next.miners.map((m) => {
              const drain = drainMap.get(m.id)
              if (!drain) return m
              const maxE = m.maxEnergy || MAX_ENERGY
              return { ...m, energy: Math.max(0, (m.energy ?? maxE) - drain), maxEnergy: maxE }
            })
          }

          const blocksChanged = result.blocks !== next.mineBlocks
          if (result.gained > 0 || blocksChanged || drainMap.size) {
            const wk = weekKey(t)
            const weekMined =
              (next.weekKey === wk ? next.weekMined || 0 : 0) + (result.gained || 0)
            const mk = monthKey(t)
            const monthMined =
              (next.monthKey === mk ? next.monthMined || 0 : 0) + (result.gained || 0)
            const seasonXp = (next.season?.xp || 0) + Math.floor(result.gained * 2)
            next = {
              ...next,
              miners,
              mineBlocks: result.blocks,
              balance: next.balance + result.gained,
              minedTotal: (next.minedTotal || 0) + result.gained,
              weekKey: wk,
              weekMined,
              monthKey: mk,
              monthMined,
              season: next.season
                ? { ...next.season, xp: seasonXp }
                : { seasonId: SEASON.id, xp: seasonXp, premium: false, claimedFree: [], claimedPremium: [], ownedSkins: ['default'], equippedSkin: 'default' },
              lastMineTickAt: t,
              history:
                result.gained > 0
                  ? pushHistory(next, {
                      id: uid(),
                      at: t,
                      amount: result.gained,
                      kind: 'mine',
                      note: `${result.events.length} bloque(s)`,
                    })
                  : next.history,
            }
            if (result.events.length) {
              playBreak()
              const batch = result.events.slice(0, 8).map((e: BreakEvent) => ({
                id: uid(),
                col: e.col,
                row: e.row,
                text: `+${e.reward.toFixed(2)}`,
                at: t,
              }))
              setFloaters((prev) => [...batch, ...prev].slice(0, 24))
            } else if (result.drains.length) {
              playPickHit()
            }
          } else {
            next = { ...next, lastMineTickAt: t }
          }
        } else if (crew.length === 0) {
          setAgents([])
          agentsRef.current = []
          next = { ...next, lastMineTickAt: t }
        }
        saveState(next)
        return next
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!floaters.length) return
    const id = window.setTimeout(() => {
      const cutoff = Date.now() - 900
      setFloaters((prev) => prev.filter((f) => f.at > cutoff))
    }, 400)
    return () => window.clearTimeout(id)
  }, [floaters])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(id)
  }, [toast])

  const flash = useCallback((msg: string) => setToast(msg), [])

  const live = useMemo(() => accrue(state, now), [state, now])
  const ratePerHour = useMemo(() => computeRate(live, now), [live, now])
  const miner = useMemo(() => activeMiner(live), [live])
  const equippedAxe = useMemo(() => getAxe(live.equippedAxeId ?? 1), [live.equippedAxeId])
  const boostLeftMs = live.boost && live.boost.endsAt > now ? live.boost.endsAt - now : 0
  const profile = powerProfile(live.levels.power)

  const claimCooldownLeft = useMemo(() => {
    if (live.skipClaimCooldown) return 0
    if (!live.lastClaimAt) return 0
    return Math.max(0, live.lastClaimAt + CLAIM_COOLDOWN_MS - now)
  }, [live, now])

  const adCooldownLeft = useMemo(
    () => Math.max(0, live.lastAdAt + AD_COOLDOWN_MS - now),
    [live, now],
  )

  const canClaim = useMemo(() => {
    const minByTime = ratePerHour * (CLAIM_MIN_MINUTES / 60)
    const enough = live.pending >= CLAIM_MIN_AMOUNT || live.pending >= minByTime
    if (!enough) return false
    if (claimCooldownLeft > 0) return false
    if (live.daily.claims >= MAX_CLAIMS_PER_DAY) return false
    const hourAgo = now - 3600_000
    const recent = live.daily.claimTimestamps.filter((t) => t >= hourAgo).length
    if (recent >= MAX_CLAIMS_PER_HOUR) return false
    return true
  }, [live, ratePerHour, claimCooldownLeft, now])

  const claim = useCallback(() => {
    setState((s) => {
      const cur = accrue(s, Date.now())
      const t = Date.now()
      const rate = computeRate(cur, t)
      const minByTime = rate * (CLAIM_MIN_MINUTES / 60)
      const enough = cur.pending >= CLAIM_MIN_AMOUNT || cur.pending >= minByTime
      if (!enough) {
        flash(`Mínimo ${CLAIM_MIN_AMOUNT} ${TOKEN} o ~${CLAIM_MIN_MINUTES} min`)
        return cur
      }
      const cd = cur.skipClaimCooldown ? 0 : Math.max(0, cur.lastClaimAt + CLAIM_COOLDOWN_MS - t)
      if (cd > 0) {
        flash('Claim en cooldown')
        return cur
      }
      const daily = cur.daily.day === dayKey(t) ? cur.daily : emptyDaily(t)
      if (daily.claims >= MAX_CLAIMS_PER_DAY) {
        flash('Límite diario de claims')
        return { ...cur, daily }
      }
      const amount = cur.pending
      const luckDust =
        activeMiner(cur)?.skills.includes('luck') ? amount * 0.02 : 0
      const record: ClaimRecord = {
        id: uid(),
        at: t,
        amount: amount + luckDust,
        kind: 'claim',
        note: luckDust ? 'incl. Fortuna' : undefined,
      }
      const next: GameState = {
        ...cur,
        daily: {
          ...daily,
          claims: daily.claims + 1,
          claimTimestamps: [...daily.claimTimestamps, t].slice(-20),
        },
        balance: cur.balance + amount + luckDust,
        pending: 0,
        totalClaimed: cur.totalClaimed + amount + luckDust,
        lastClaimAt: t,
        skipClaimCooldown: false,
        history: pushHistory(cur, record),
      }
      saveState(next)
      flash(`+${(amount + luckDust).toFixed(2)} ${TOKEN}`)
      return next
    })
  }, [flash])

  const buyUpgrade = useCallback(
    (id: 'pickaxe' | 'rig' | 'power') => {
      setState((s) => {
        const cur = accrue(s, Date.now())
        const def = UPGRADES.find((u) => u.id === id)!
        const level = cur.levels[id]
        if (level >= def.maxLevel) {
          flash('Nivel máximo')
          return cur
        }
        const cost = upgradeCost(def, level)
        if (cur.balance < cost) {
          flash('Saldo insuficiente')
          return cur
        }
        const next: GameState = {
          ...cur,
          balance: cur.balance - cost,
          levels: { ...cur.levels, [id]: level + 1 },
        }
        saveState(next)
        flash(`${def.name} → nv.${level + 1}`)
        return next
      })
    },
    [flash],
  )

  const buyBox = useCallback(
    (boxId: BoxId, pay: 'usd' | 'mine' = 'usd') => {
      const t = Date.now()
      const box = BOXES.find((b) => b.id === boxId)!
      const curLive = accrue(state, t)
      if (curLive.miners.length >= MAX_MINERS) {
        flash(`Máximo ${MAX_MINERS} mineros en colección`)
        return
      }
      if (pay === 'mine' && curLive.balance < box.priceMine) {
        flash(`Necesitas ${box.priceMine} ${TOKEN}`)
        return
      }
      const rarity = rollRarityFromBox(boxId)
      const minerNew = createMiner(rarity, t)
      setState((s) => {
        let cur = ensureDaily(accrue(s, Date.now()), Date.now())
        if (cur.miners.length >= MAX_MINERS) return cur
        if (pay === 'mine' && cur.balance < box.priceMine) return cur
        // Evitar doble cargo StrictMode si ya existe este id
        if (cur.miners.some((m) => m.id === minerNew.id)) return cur
        const deployed = [...(cur.deployedMinerIds ?? []), minerNew.id].slice(0, MAX_MINERS)
        const next: GameState = {
          ...cur,
          balance: pay === 'mine' ? cur.balance - box.priceMine : cur.balance,
          miners: [minerNew, ...cur.miners].slice(0, MAX_MINERS),
          activeMinerId: cur.activeMinerId ?? minerNew.id,
          deployedMinerIds: deployed,
          lastBoxId: boxId,
          daily: { ...cur.daily, boxesOpened: cur.daily.boxesOpened + 1 },
          history: pushHistory(cur, {
            id: uid(),
            at: Date.now(),
            amount: pay === 'mine' ? box.priceMine : box.priceUsd,
            kind: pay === 'usd' ? 'iap' : 'box',
            note:
              pay === 'usd'
                ? `Pago DEMO ${formatUsd(box.priceUsd)} · ${box.name} → ${minerNew.name}`
                : `${box.name} → ${minerNew.name}`,
          }),
        }
        saveState(next)
        return next
      })
      setOpening({ boxId, miner: minerNew })
      flash(pay === 'usd' ? `Pago DEMO ${formatUsd(box.priceUsd)} · ¡caja!` : '¡Caja abierta!')
    },
    [flash, state],
  )

  const toggleDeploy = useCallback(
    (id: string) => {
      setState((s) => {
        const cur = accrue(s, Date.now())
        if (!cur.miners.some((m) => m.id === id)) return cur
        // Cupo solo con ids válidos (stale post-gift bloqueaba Desplegar)
        const clean = sanitizeDeployedIds(cur.deployedMinerIds, cur.miners)
        const set = new Set(clean)
        if (set.has(id)) {
          if (set.size <= 1) {
            flash('Deja al menos 1 minero en mina')
            return cur
          }
          set.delete(id)
        } else {
          if (set.size >= MAX_MINERS) {
            flash(`Máximo ${MAX_MINERS} activos`)
            return cur
          }
          set.add(id)
        }
        const next = {
          ...cur,
          deployedMinerIds: sanitizeDeployedIds([...set], cur.miners),
          activeMinerId: id,
        }
        saveState(next)
        flash(set.has(id) ? 'Minero a la mina' : 'Minero retirado')
        return next
      })
    },
    [flash],
  )

  const dismissOpening = useCallback(() => setOpening(null), [])

  const selectMiner = useCallback(
    (id: string) => {
      setState((s) => {
        const cur = accrue(s, Date.now())
        if (!cur.miners.some((m) => m.id === id)) return cur
        const next = { ...cur, activeMinerId: id }
        saveState(next)
        flash('Minero activo cambiado')
        return next
      })
    },
    [flash],
  )

  const buyAxe = useCallback(
    (axeId: number) => {
      setState((s) => {
        const cur = accrue(s, Date.now())
        const def = getAxe(axeId)
        if (cur.ownedAxes.includes(def.id)) {
          flash('Ya tienes esta hacha')
          return cur
        }
        if (cur.balance < def.priceMine) {
          flash(`Necesitas ${def.priceMine} ${TOKEN}`)
          return cur
        }
        const next: GameState = {
          ...cur,
          balance: cur.balance - def.priceMine,
          ownedAxes: [...cur.ownedAxes, def.id].sort((a, b) => a - b),
          equippedAxeId: def.id,
          history: pushHistory(cur, {
            id: uid(),
            at: Date.now(),
            amount: def.priceMine,
            kind: 'axe',
            note: `Compró ${def.name}`,
          }),
        }
        saveState(next)
        flash(`¡${def.name} desbloqueada y equipada!`)
        return next
      })
    },
    [flash],
  )

  const equipAxe = useCallback(
    (axeId: number) => {
      setState((s) => {
        const cur = accrue(s, Date.now())
        if (!cur.ownedAxes.includes(axeId)) {
          flash('Hacha no desbloqueada')
          return cur
        }
        const def = getAxe(axeId)
        const next = { ...cur, equippedAxeId: axeId }
        saveState(next)
        flash(`Equipada: ${def.name}`)
        return next
      })
    },
    [flash],
  )

  const upgradeMiner = useCallback(
    (id: string) => {
      setState((s) => {
        const cur = accrue(s, Date.now())
        const idx = cur.miners.findIndex((m) => m.id === id)
        if (idx < 0) return cur
        const m = cur.miners[idx]
        const cost = upgradeMinerCost(m.level)
        if (cur.balance < cost) {
          flash('Saldo insuficiente')
          return cur
        }
        if (m.level >= 6) {
          flash('Rank máximo (Mítico)')
          return cur
        }
        const upgraded = applyMinerUpgrade(m)
        const miners = [...cur.miners]
        miners[idx] = upgraded
        const next: GameState = {
          ...cur,
          balance: cur.balance - cost,
          miners,
          history: pushHistory(cur, {
            id: uid(),
            at: Date.now(),
            amount: cost,
            kind: 'upgrade_miner',
            note: `${upgraded.name} rank ${upgraded.level}`,
          }),
        }
        saveState(next)
        flash(`Mejorado → ${upgraded.name} (NIVEL ${upgraded.level})`)
        return next
      })
    },
    [flash],
  )

  const grantAdReward = useCallback(
    (adId: AdRewardId): { ok: boolean; reason?: string } => {
      let result: { ok: boolean; reason?: string } = { ok: false, reason: 'error' }
      setState((s) => {
        const t = Date.now()
        let cur = ensureDaily(accrue(s, t), t)
        if (t - cur.lastAdAt < AD_COOLDOWN_MS) {
          result = { ok: false, reason: 'Cooldown de anuncio' }
          return cur
        }
        if (cur.daily.adsTotal >= AD_TOTAL_PER_DAY) {
          result = { ok: false, reason: 'Límite diario de ads' }
          return cur
        }
        const def = AD_REWARDS.find((a) => a.id === adId)!
        const used = cur.daily.adsByType[adId] ?? 0
        if (used >= def.dailyLimit) {
          result = { ok: false, reason: 'Límite de este reward' }
          return cur
        }

        let next = { ...cur }
        let note = def.name

        if (def.kind === 'boost' && def.multiplier && def.durationMs) {
          const current = next.boost && next.boost.endsAt > t ? next.boost : null
          if (current && current.multiplier > def.multiplier) {
            result = { ok: false, reason: 'Boost mayor activo — ad no consumido' }
            return cur
          }
          next = {
            ...next,
            boost: { source: def.name, multiplier: def.multiplier, endsAt: t + def.durationMs },
          }
        } else if (def.kind === 'instant') {
          next = { ...next, skipClaimCooldown: true }
          note = 'Claim sin cooldown'
        } else if (def.kind === 'pack') {
          const rate = computeRate(next, t)
          const amount = rate * (15 / 60)
          next = {
            ...next,
            balance: next.balance + amount,
            history: pushHistory(next, {
              id: uid(),
              at: t,
              amount,
              kind: 'ad',
              note: 'Pack 15 min',
            }),
          }
          note = `+${amount.toFixed(2)} ${TOKEN}`
        } else if (def.kind === 'chest') {
          const amount = 10 + Math.floor(Math.random() * 31)
          next = {
            ...next,
            balance: next.balance + amount,
            history: pushHistory(next, {
              id: uid(),
              at: t,
              amount,
              kind: 'ad',
              note: 'Lucky chest',
            }),
          }
          note = `Chest +${amount} ${TOKEN}`
        }

        next = {
          ...next,
          lastAdAt: t,
          daily: {
            ...next.daily,
            adsTotal: next.daily.adsTotal + 1,
            adsByType: {
              ...next.daily.adsByType,
              [adId]: (next.daily.adsByType[adId] ?? 0) + 1,
            },
          },
        }
        saveState(next)
        flash(note)
        result = { ok: true }
        return next
      })
      return result
    },
    [flash],
  )

  const buyIap = useCallback(
    (sku: IapSku) => {
      setState((s) => {
        const t = Date.now()
        let cur = ensureDaily(accrue(s, t), t)
        const applyBoost = (mult: number, ms: number, source: string) => {
          const current = cur.boost && cur.boost.endsAt > t ? cur.boost : null
          if (current && current.multiplier > mult) return
          cur = { ...cur, boost: { source, multiplier: mult, endsAt: t + ms } }
        }
        const credit = (amount: number, note: string) => {
          cur = {
            ...cur,
            balance: cur.balance + amount,
            history: pushHistory(cur, { id: uid(), at: t, amount, kind: 'iap', note }),
          }
        }
        switch (sku) {
          case 'starter': {
            if (cur.daily.iapStarterBought) {
              flash('Starter ya comprado hoy')
              return cur
            }
            const mid = getEnergyPack('medium')
            cur = {
              ...cur,
              miners: cur.miners.map((m) => ({
                ...m,
                maxEnergy: mid.maxEnergy,
                energy: mid.maxEnergy,
              })),
              daily: { ...cur.daily, iapStarterBought: true },
              history: pushHistory(cur, {
                id: uid(),
                at: t,
                amount: 4.99,
                kind: 'iap',
                note: 'Pago DEMO $4.99 · Starter (⚡ Medio)',
              }),
            }
            // Caja rara incluida (si hay cupo)
            if (cur.miners.length < MAX_MINERS) {
              const rarity = rollRarityFromBox('rare')
              const minerNew = createMiner(rarity, t)
              const deployed = [...(cur.deployedMinerIds ?? []), minerNew.id].slice(0, MAX_MINERS)
              cur = {
                ...cur,
                miners: [minerNew, ...cur.miners].slice(0, MAX_MINERS),
                activeMinerId: cur.activeMinerId ?? minerNew.id,
                deployedMinerIds: deployed,
                lastBoxId: 'rare',
                daily: { ...cur.daily, boxesOpened: cur.daily.boxesOpened + 1 },
              }
              setOpening({ boxId: 'rare', miner: minerNew })
            }
            flash('Pago DEMO $4.99 · Starter Pack')
            break
          }
          case 'boost2h':
            applyBoost(2, 2 * 3600_000, 'IAP ×2 2h')
            flash('Boost ×2 DEMO')
            break
          case 'boost5':
            applyBoost(5, 3600_000, 'IAP ×5 1h')
            flash('Boost ×5 DEMO')
            break
          case 'mega':
            if (cur.daily.megaBought) {
              flash('Mega ya comprado hoy')
              return cur
            }
            applyBoost(10, 30 * 60_000, 'Mega ×10')
            cur = { ...cur, daily: { ...cur.daily, megaBought: true } }
            flash('Mega Shift DEMO')
            break
          case 'minerBundle':
            credit(1000, 'Miner Bundle')
            applyBoost(2, 4 * 3600_000, 'Bundle ×2')
            if (cur.levels.power < 10) {
              cur = { ...cur, levels: { ...cur.levels, power: cur.levels.power + 1 } }
            }
            flash('Miner Bundle DEMO')
            break
        }
        saveState(cur)
        return cur
      })
    },
    [flash],
  )

  const withdrawDemo = useCallback(() => {
    setState((s) => {
      const t = Date.now()
      let cur = ensureDaily(accrue(s, t), t)
      if (cur.balance < 100) {
        flash(`Mínimo 100 ${TOKEN}`)
        return cur
      }
      if (cur.lastWithdrawAt && t - cur.lastWithdrawAt < WITHDRAW_COOLDOWN_MS) {
        flash('Cooldown 24 h entre retiros DEMO')
        return cur
      }
      if (cur.daily.withdrawCount >= WITHDRAW_MAX_COUNT_PER_DAY) {
        flash('Máx 2 retiros DEMO / día')
        return cur
      }
      const room = WITHDRAW_MAX_PER_DAY - cur.daily.withdrawAmount
      if (room <= 0) {
        flash('Cap diario de retiro alcanzado')
        return cur
      }
      const amount = Math.min(cur.balance, room)
      const next: GameState = {
        ...cur,
        balance: cur.balance - amount,
        withdrawn: cur.withdrawn + amount,
        lastWithdrawAt: t,
        daily: {
          ...cur.daily,
          withdrawCount: cur.daily.withdrawCount + 1,
          withdrawAmount: cur.daily.withdrawAmount + amount,
        },
        history: pushHistory(cur, {
          id: uid(),
          at: t,
          amount,
          kind: 'withdraw',
          note: 'Demo Vault',
        }),
      }
      saveState(next)
      flash(`Retiro DEMO +${amount.toFixed(2)}`)
      return next
    })
  }, [flash])

  const buyEnergy = useCallback(
    (packId: EnergyPackId = 'basic', pay: 'usd' | 'mine' = 'usd') => {
      const pack = getEnergyPack(packId)
      setState((s) => {
        const cur = accrue(s, Date.now())
        if (pay === 'mine' && cur.balance < pack.priceMine) {
          flash(`Necesitas ${pack.priceMine} ${TOKEN}`)
          return cur
        }
        const need = cur.miners.some(
          (m) => (m.energy ?? 0) < pack.maxEnergy || (m.maxEnergy || MAX_ENERGY) < pack.maxEnergy,
        )
        if (!need) {
          flash('Energía ya al máximo de este pack')
          return cur
        }
        const next: GameState = {
          ...cur,
          balance: pay === 'mine' ? cur.balance - pack.priceMine : cur.balance,
          miners: cur.miners.map((m) => ({
            ...m,
            maxEnergy: pack.maxEnergy,
            energy: pack.maxEnergy,
          })),
          history: pushHistory(cur, {
            id: uid(),
            at: Date.now(),
            amount: pay === 'mine' ? pack.priceMine : pack.priceUsd,
            kind: pay === 'usd' ? 'iap' : 'energy',
            note:
              pay === 'usd'
                ? `Pago DEMO ${formatUsd(pack.priceUsd)} · ⚡ ${pack.name} → ${pack.maxEnergy}`
                : `${pack.symbol.repeat(pack.bolts)} ${pack.name} → ${pack.maxEnergy}`,
          }),
        }
        saveState(next)
        flash(
          pay === 'usd'
            ? `Pago DEMO ${formatUsd(pack.priceUsd)} · ⚡ ${pack.name}`
            : `${pack.symbol.repeat(pack.bolts)} Pack ${pack.name} · ${pack.maxEnergy} energía`,
        )
        return next
      })
    },
    [flash],
  )

  const simulateInvite = useCallback(() => {
    setState((s) => {
      const cur = accrue(s, Date.now())
      const ref = cur.referral
      if (!ref || ref.invited >= MAX_REFERRALS) {
        flash('Máx referidos DEMO')
        return cur
      }
      const next = {
        ...cur,
        balance: cur.balance + REFERRAL_REWARD_MINE,
        referral: { ...ref, invited: ref.invited + 1 },
        history: pushHistory(cur, {
          id: uid(),
          at: Date.now(),
          amount: REFERRAL_REWARD_MINE,
          kind: 'referral',
          note: `Invitado DEMO +${REFERRAL_REWARD_MINE} MINE`,
        }),
      }
      saveState(next)
      flash(`Referido DEMO +${REFERRAL_REWARD_MINE} MINE`)
      return next
    })
  }, [flash])

  const redeemReferral = useCallback(
    (code: string) => {
      const trimmed = code.trim().toUpperCase()
      setState((s) => {
        const cur = accrue(s, Date.now())
        const ref = cur.referral
        if (!ref) return cur
        if (ref.usedInvite) {
          flash('Ya canjeaste un código')
          return cur
        }
        if (!isValidReferralCode(trimmed) || trimmed === ref.code.toUpperCase()) {
          flash('Código inválido')
          return cur
        }
        if (cur.miners.length >= MAX_MINERS) {
          flash('Colección llena — solo MINE')
        }
        let next = {
          ...cur,
          balance: cur.balance + REFERRAL_REWARD_MINE,
          referral: { ...ref, usedInvite: trimmed },
          daily: { ...cur.daily, referralsRedeemed: (cur.daily.referralsRedeemed || 0) + 1 },
          history: pushHistory(cur, {
            id: uid(),
            at: Date.now(),
            amount: REFERRAL_REWARD_MINE,
            kind: 'referral',
            note: `Código ${trimmed}`,
          }),
        }
        if (next.miners.length < MAX_MINERS) {
          const rarity = rollRarityFromBox(REFERRAL_REWARD_BOX)
          const minerNew = createMiner(rarity, Date.now())
          next = {
            ...next,
            miners: [minerNew, ...next.miners].slice(0, MAX_MINERS),
            deployedMinerIds: [...(next.deployedMinerIds ?? []), minerNew.id].slice(0, MAX_MINERS),
            lastBoxId: REFERRAL_REWARD_BOX,
          }
          setOpening({ boxId: REFERRAL_REWARD_BOX, miner: minerNew })
        }
        saveState(next)
        flash(`Código OK +${REFERRAL_REWARD_MINE} MINE + caja`)
        return next
      })
    },
    [flash],
  )

  const buySeasonPass = useCallback(() => {
    setState((s) => {
      const cur = accrue(s, Date.now())
      if (cur.season?.premium) {
        flash('Pase ya activo')
        return cur
      }
      const next = {
        ...cur,
        season: { ...cur.season!, premium: true },
        history: pushHistory(cur, {
          id: uid(),
          at: Date.now(),
          amount: SEASON.priceUsd,
          kind: 'season',
          note: `Pago DEMO $${SEASON.priceUsd} · Pase`,
        }),
      }
      saveState(next)
      flash(`Pago DEMO $${SEASON.priceUsd} · Pase temporada`)
      return next
    })
  }, [flash])

  const claimSeasonTier = useCallback(
    (tier: number, track: 'free' | 'premium') => {
      setState((s) => {
        const cur = accrue(s, Date.now())
        const season = cur.season
        if (!season) return cur
        const row = SEASON_TRACK.find((r) => r.tier === tier)
        if (!row || season.xp < row.xpNeed) {
          flash('XP insuficiente')
          return cur
        }
        if (track === 'premium' && !season.premium) {
          flash('Necesitas pase premium')
          return cur
        }
        const claimed = track === 'free' ? season.claimedFree : season.claimedPremium
        if (claimed.includes(tier)) {
          flash('Ya reclamado')
          return cur
        }
        const reward = track === 'free' ? row.free : row.premium
        let next = {
          ...cur,
          season: {
            ...season,
            claimedFree: track === 'free' ? [...season.claimedFree, tier] : season.claimedFree,
            claimedPremium: track === 'premium' ? [...season.claimedPremium, tier] : season.claimedPremium,
          },
        }
        if (reward.kind === 'mine') {
          next = {
            ...next,
            balance: next.balance + Number(reward.value),
            history: pushHistory(next, {
              id: uid(),
              at: Date.now(),
              amount: Number(reward.value),
              kind: 'season',
              note: `T${tier} ${reward.label}`,
            }),
          }
        } else if (reward.kind === 'skin') {
          const skin = reward.value as SkinId
          if (!next.season.ownedSkins.includes(skin)) {
            next = {
              ...next,
              season: {
                ...next.season,
                ownedSkins: [...next.season.ownedSkins, skin],
                equippedSkin: skin,
              },
            }
          }
        } else if (reward.kind === 'energy') {
          const pack = getEnergyPack(reward.value as EnergyPackId)
          next = {
            ...next,
            miners: next.miners.map((m) => ({
              ...m,
              maxEnergy: pack.maxEnergy,
              energy: pack.maxEnergy,
            })),
          }
        } else if (reward.kind === 'box' && next.miners.length < MAX_MINERS) {
          const rarity = rollRarityFromBox(reward.value as BoxId)
          const minerNew = createMiner(rarity, Date.now())
          next = {
            ...next,
            miners: [minerNew, ...next.miners].slice(0, MAX_MINERS),
            deployedMinerIds: [...(next.deployedMinerIds ?? []), minerNew.id].slice(0, MAX_MINERS),
            lastBoxId: reward.value as BoxId,
          }
          setOpening({ boxId: reward.value as BoxId, miner: minerNew })
        }
        saveState(next)
        flash(`Recompensa T${tier}: ${reward.label}`)
        return next
      })
    },
    [flash],
  )

  const equipSkin = useCallback(
    (skin: SkinId) => {
      setState((s) => {
        const cur = accrue(s, Date.now())
        if (!cur.season?.ownedSkins.includes(skin)) {
          flash('Skin bloqueada')
          return cur
        }
        const next = { ...cur, season: { ...cur.season, equippedSkin: skin } }
        saveState(next)
        flash(`Skin ${SKINS[skin].name}`)
        return next
      })
    },
    [flash],
  )

  const completeStripeMock = useCallback(
    (productId: StripeProductId) => {
      const session = completeMockCheckout(createMockCheckout(productId))
      if (productId.startsWith('energy_')) {
        const map: Record<string, EnergyPackId> = {
          energy_basic: 'basic',
          energy_medium: 'medium',
          energy_large: 'large',
        }
        buyEnergy(map[productId] ?? 'basic', 'usd')
      } else if (productId.startsWith('box_')) {
        const map: Record<string, BoxId> = {
          box_common: 'common',
          box_rare: 'rare',
          box_legendary: 'legendary',
        }
        buyBox(map[productId] ?? 'common', 'usd')
      } else if (productId === 'starter') {
        buyIap('starter')
      } else if (productId === 'season_pass') {
        buySeasonPass()
      }
      flash(`Stripe mock OK · ${session.id}`)
      return session
    },
    [buyEnergy, buyBox, buyIap, buySeasonPass, flash],
  )

  const resetDemo = useCallback(() => {
    const fresh = defaultState(Date.now())
    saveState(fresh)
    setState(fresh)
    setOpening(null)
    flash('Progreso reiniciado')
  }, [flash])

  const claimMonthlyPrize = useCallback(() => {
    setState((s) => {
      const t = Date.now()
      const cur = settleMonthIfNeeded(
        accrue(s, t),
        t,
        s.deployedMinerIds?.length || s.miners.length || 1,
      )
      const pending = cur.pendingMonthlyPrize
      if (!pending) {
        flash('No hay premio mensual pendiente')
        return cur
      }
      const prize = prizeForPlace(pending.place)
      if (!prize) {
        flash('Premio inválido')
        return cur
      }
      const histIdx = cur.monthlyWinnersHistory.findIndex((h) => h.monthKey === pending.monthKey)
      if (histIdx < 0) {
        flash('Mes no encontrado en historial')
        return cur
      }
      const rec = cur.monthlyWinnersHistory[histIdx]
      const slot = rec.slots.find((sl) => sl.you && sl.place === pending.place)
      if (!slot || slot.claimed) {
        flash(slot?.claimed ? 'Premio ya reclamado' : 'No calificas para este premio')
        return cur
      }

      let next: GameState = {
        ...cur,
        balance: cur.balance + prize.mine,
        pendingMonthlyPrize: null,
        monthlyWinnersHistory: cur.monthlyWinnersHistory.map((h, i) =>
          i !== histIdx
            ? h
            : {
                ...h,
                slots: h.slots.map((sl) =>
                  sl.you && sl.place === pending.place ? { ...sl, claimed: true } : sl,
                ),
              },
        ),
        history: pushHistory(cur, {
          id: uid(),
          at: t,
          amount: prize.mine,
          kind: 'monthly_prize',
          note: `${prize.title} · ${pending.monthKey} · nota USDT $${prize.usdtNoteUsd} (operador)`,
        }),
      }

      const pack = getEnergyPack(prize.energyPackId)
      next = {
        ...next,
        miners: next.miners.map((m) => ({
          ...m,
          maxEnergy: Math.max(m.maxEnergy || MAX_ENERGY, pack.maxEnergy),
          energy: pack.maxEnergy,
        })),
      }

      const skins = next.season?.ownedSkins ?? ['default']
      if (!skins.includes(prize.skinId)) {
        next = {
          ...next,
          season: {
            ...next.season!,
            ownedSkins: [...skins, prize.skinId],
            equippedSkin: prize.skinId,
          },
        }
      }

      if (next.miners.length < MAX_MINERS) {
        const rarity = rollRarityFromBox(prize.boxId)
        const minerNew = createMiner(rarity, t)
        next = {
          ...next,
          miners: [minerNew, ...next.miners].slice(0, MAX_MINERS),
          deployedMinerIds: [...(next.deployedMinerIds ?? []), minerNew.id].slice(0, MAX_MINERS),
          lastBoxId: prize.boxId,
        }
        setOpening({ boxId: prize.boxId, miner: minerNew })
      }

      saveState(next)
      flash(`¡Premio mensual ${prize.title} reclamado!`)
      return next
    })
  }, [flash])

  /** Operador: marca nota USDT del ganador como pagada (manual, sin API payout) */
  const markMonthlyUsdtPaid = useCallback(
    (month: string, place: MonthlyPrizePlace, operatorOk: boolean) => {
      if (!operatorOk) {
        flash('Solo el operador puede marcar pago USDT')
        return
      }
      setState((s) => {
        const cur = accrue(s, Date.now())
        const next: GameState = {
          ...cur,
          monthlyWinnersHistory: cur.monthlyWinnersHistory.map((h) =>
            h.monthKey !== month
              ? h
              : {
                  ...h,
                  slots: h.slots.map((sl) =>
                    sl.place === place ? { ...sl, usdtPending: false } : sl,
                  ),
                },
          ),
          history: pushHistory(cur, {
            id: uid(),
            at: Date.now(),
            amount: 0,
            kind: 'monthly_prize',
            note: `USDT pagado · ${month} · puesto #${place}`,
          }),
        }
        saveState(next)
        flash(`USDT #${place} · ${month} marcado pagado`)
        return next
      })
    },
    [flash],
  )

  /**
   * Unlock gifts only after server claim consume (POST /api/me/operator/claim).
   * Passing a client boolean is not enough — caller must await claimOperatorGiftsOnServer first.
   */
  const claimOperatorGifts = useCallback(
    async (serverClaimOk: boolean) => {
      if (!serverClaimOk) {
        flash('Regalos bloqueados · servidor no autorizó el claim')
        return false
      }
      let ok = false
      setState((s) => {
        const cur = accrue(s, Date.now())
        if (giftsFullyClaimed(cur.operatorGiftsClaimed, cur.operatorGiftsGen ?? 0)) {
          const repaired = applyOperatorGifts(cur, Date.now())
          const sameRoster =
            repaired.miners.length === cur.miners.length &&
            repaired.miners.every((m, i) => m.id === cur.miners[i]?.id && m.coreAttrs?.fuerza === 150)
          if (
            sameRoster &&
            repaired.deployedMinerIds.join() ===
              sanitizeDeployedIds(cur.deployedMinerIds, cur.miners).join() &&
            (cur.ownedAxes ?? []).includes(6)
          ) {
            flash('Regalos ya reclamados')
            return cur
          }
          const next = {
            ...repaired,
            history: pushHistory(cur, {
              id: uid(),
              at: Date.now(),
              amount: 0,
              kind: 'gift',
              note: 'Repair REGALO · 2× Mítico 150 + hacha 6',
            }),
          }
          saveState(next)
          flash('Regalos reparados · Mítico 150 ×2 en mina')
          ok = true
          return next
        }
        const t = Date.now()
        const granted = applyOperatorGifts(cur, t)
        const next: GameState = {
          ...granted,
          history: pushHistory(cur, {
            id: uid(),
            at: t,
            amount: 0,
            kind: 'gift',
            note: '2 cajas REGALO · server claim · Andres Medina',
          }),
        }
        saveState(next)
        flash('¡2 cajas REGALO · Mítico 150 ×2!')
        ok = true
        return next
      })
      return ok
    },
    [flash],
  )

  const crew = useMemo(() => deployedMiners(live), [live])

  return {
    state: live,
    now,
    pending: live.pending,
    balance: live.balance,
    ratePerHour,
    miner,
    miners: live.miners,
    crew,
    deployedMinerIds: live.deployedMinerIds ?? [],
    mineBlocks: live.mineBlocks ?? [],
    minedTotal: live.minedTotal ?? 0,
    weekMined: live.weekMined ?? 0,
    monthMined: live.monthMined ?? 0,
    monthKey: live.monthKey ?? monthKey(),
    monthlyWinnersHistory: live.monthlyWinnersHistory ?? [],
    pendingMonthlyPrize: live.pendingMonthlyPrize ?? null,
    claimMonthlyPrize,
    markMonthlyUsdtPaid,
    referral: live.referral,
    season: live.season,
    operatorGiftsClaimed: giftsFullyClaimed(
      live.operatorGiftsClaimed,
      live.operatorGiftsGen ?? 0,
    ),
    floaters,
    agents,
    maxMiners: MAX_MINERS,
    equippedAxe,
    ownedAxes: live.ownedAxes,
    buyAxe,
    equipAxe,
    simulateInvite,
    redeemReferral,
    buySeasonPass,
    claimSeasonTier,
    equipSkin,
    completeStripeMock,
    claimOperatorGifts,
    seasonTier: seasonTierFromXp(live.season?.xp ?? 0),
    boostLeftMs,
    boost: live.boost,
    profile,
    toast,
    opening,
    canClaim,
    claimCooldownLeft,
    adCooldownLeft,
    claim,
    buyUpgrade,
    buyBox,
    buyEnergy,
    energyItem: ENERGY_ITEM,
    energyPacks: ENERGY_PACKS,
    dismissOpening,
    selectMiner,
    toggleDeploy,
    upgradeMiner,
    grantAdReward,
    buyIap,
    withdrawDemo,
    resetDemo,
  }
}
