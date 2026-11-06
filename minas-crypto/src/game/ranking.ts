/** Ranking semanal DEMO (local + rivales ficticios) */

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

export function weekKey(now = Date.now()): string {
  const d = new Date(now)
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

/** Rivales escalan con la semana para que el board se mueva */
export function weeklyBoard(youMined: number, youMiners: number, youName = 'Andres Medina', now = Date.now()): RankEntry[] {
  const w = weekKey(now)
  let seed = 0
  for (let i = 0; i < w.length; i++) seed = (seed * 33 + w.charCodeAt(i)) >>> 0
  const rivals: RankEntry[] = RIVALS.map((r, i) => {
    const wobble = ((seed >> (i % 8)) & 255) / 255
    const mined = Math.round(80 + i * 40 + wobble * 220 + (seed % 50))
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

export function yourRank(board: RankEntry[]): number {
  const i = board.findIndex((e) => e.you)
  return i < 0 ? board.length : i + 1
}
