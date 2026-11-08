/** Ranking semanal + mensual DEMO (local + rivales ficticios) */

import type { BoxId } from './miners'
import type { EnergyPackId } from './energy'
import type { SkinId } from './season'

export type RankEntry = {
  id: string
  name: string
  mined: number
  miners: number
  you?: boolean
}

const RIVALS: Omit<RankEntry, 'mined'>[] = [
  { id: 'r1', name: 'DigKing', miners: 10 },
  { id: 'r2', name: 'MinaPro', miners: 8 },
  { id: 'r3', name: 'CavaBot', miners: 9 },
  { id: 'r4', name: 'OreFox', miners: 6 },
  { id: 'r5', name: 'PixelPick', miners: 7 },
  { id: 'r6', name: 'RubyRush', miners: 5 },
  { id: 'r7', name: 'DeepDigger', miners: 8 },
  { id: 'r8', name: 'GoldGato', miners: 4 },
]

/** America/Bogota = UTC−5 todo el año (sin DST) */
const BOGOTA_OFFSET_MS = 5 * 3600_000

function bogotaParts(now = Date.now()): { y: number; m: number; d: number } {
  const b = new Date(now - BOGOTA_OFFSET_MS)
  return { y: b.getUTCFullYear(), m: b.getUTCMonth() + 1, d: b.getUTCDate() }
}

export function weekKey(now = Date.now()): string {
  const d = new Date(now)
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

/** Clave de mes calendario en America/Bogota · ej. 2026-11 */
export function monthKey(now = Date.now()): string {
  const { y, m } = bogotaParts(now)
  return `${y}-${String(m).padStart(2, '0')}`
}

export function monthLabel(key: string): string {
  const [ys, ms] = key.split('-')
  const y = Number(ys)
  const m = Number(ms)
  if (!y || !m) return key
  const names = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ]
  return `${names[m - 1] ?? ms} ${y}`
}

/** Días restantes del mes (Bogotá), contando el día actual */
export function daysLeftInMonth(now = Date.now()): number {
  const { y, m, d } = bogotaParts(now)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Math.max(0, last - d)
}

function seedFromKey(key: string): number {
  let seed = 0
  for (let i = 0; i < key.length; i++) seed = (seed * 33 + key.charCodeAt(i)) >>> 0
  return seed
}

function boardForKey(
  key: string,
  youMined: number,
  youMiners: number,
  youName: string,
  base: number,
  step: number,
  wobbleAmp: number,
): RankEntry[] {
  const seed = seedFromKey(key)
  const rivals: RankEntry[] = RIVALS.map((r, i) => {
    const wobble = ((seed >> (i % 8)) & 255) / 255
    const mined = Math.round(base + i * step + wobble * wobbleAmp + (seed % 50))
    return { ...r, mined }
  })
  const you: RankEntry = {
    id: 'you',
    name: youName,
    mined: Math.round(youMined),
    miners: youMiners,
    you: true,
  }
  return [...rivals, you].sort((a, b) => b.mined - a.mined)
}

/** Rivales escalan con la semana para que el board se mueva */
export function weeklyBoard(youMined: number, youMiners: number, youName = 'Andres Medina', now = Date.now()): RankEntry[] {
  return boardForKey(weekKey(now), youMined, youMiners, youName, 80, 40, 220)
}

/** Board mensual — misma métrica (MINE minado) que el semanal */
export function monthlyBoard(
  youMined: number,
  youMiners: number,
  youName = 'Andres Medina',
  now = Date.now(),
): RankEntry[] {
  return boardForKey(monthKey(now), youMined, youMiners, youName, 320, 160, 900)
}

export function yourRank(board: RankEntry[]): number {
  const i = board.findIndex((e) => e.you)
  return i < 0 ? board.length : i + 1
}

export type MonthlyPrizePlace = 1 | 2 | 3

export type MonthlyPrizeDef = {
  place: MonthlyPrizePlace
  medal: string
  title: string
  blurb: string
  mine: number
  boxId: BoxId
  energyPackId: EnergyPackId
  skinId: SkinId
  /** Nota de crédito USDT — pago manual del operador, no API de payout */
  usdtNoteUsd: number
}

/** Premios top 3 — reusan cajas / energía / skins existentes (sin regalos operador) */
export const MONTHLY_PRIZES: MonthlyPrizeDef[] = [
  {
    place: 1,
    medal: '🥇',
    title: '1.º · Oro',
    blurb: 'Caja legendaria + ⚡ Grande + skin CAVA Gold + 800 MINE',
    mine: 800,
    boxId: 'legendary',
    energyPackId: 'large',
    skinId: 'cava_gold',
    usdtNoteUsd: 25,
  },
  {
    place: 2,
    medal: '🥈',
    title: '2.º · Plata',
    blurb: 'Caja rara + ⚡ Medio + skin Mítico + 400 MINE',
    mine: 400,
    boxId: 'rare',
    energyPackId: 'medium',
    skinId: 'mythic',
    usdtNoteUsd: 15,
  },
  {
    place: 3,
    medal: '🥉',
    title: '3.º · Bronce',
    blurb: 'Caja común + ⚡ Básico + skin Frost + 200 MINE',
    mine: 200,
    boxId: 'common',
    energyPackId: 'basic',
    skinId: 'frost',
    usdtNoteUsd: 10,
  },
]

export function prizeForPlace(place: number): MonthlyPrizeDef | undefined {
  return MONTHLY_PRIZES.find((p) => p.place === place)
}

export type MonthlyWinnerSlot = {
  place: MonthlyPrizePlace
  id: string
  name: string
  mined: number
  you?: boolean
  claimed: boolean
  /** Nota USDT pendiente de pago operador */
  usdtPending: boolean
}

export type MonthlyWinnersRecord = {
  monthKey: string
  settledAt: number
  slots: MonthlyWinnerSlot[]
}

export type PendingMonthlyPrize = {
  monthKey: string
  place: MonthlyPrizePlace
}

/** Snapshot top 3 al cerrar un mes */
export function settleMonthlyWinners(
  closedMonthKey: string,
  board: RankEntry[],
  settledAt = Date.now(),
): MonthlyWinnersRecord {
  const slots: MonthlyWinnerSlot[] = board.slice(0, 3).map((e, i) => {
    const place = (i + 1) as MonthlyPrizePlace
    const prize = prizeForPlace(place)!
    return {
      place,
      id: e.id,
      name: e.name,
      mined: e.mined,
      you: e.you,
      claimed: false,
      usdtPending: prize.usdtNoteUsd > 0,
    }
  })
  return { monthKey: closedMonthKey, settledAt, slots }
}

export function pendingPrizeFromRecord(rec: MonthlyWinnersRecord): PendingMonthlyPrize | null {
  const you = rec.slots.find((s) => s.you && !s.claimed)
  if (!you) return null
  return { monthKey: rec.monthKey, place: you.place }
}
