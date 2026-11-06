/** Mapa Dig: capas + minerales raros (CAVA DEMO) */

export const MAX_MINERS = 10
export const FIELD_COLS = 12
export const FIELD_ROWS = 6
export const FIELD_SIZE = FIELD_COLS * FIELD_ROWS

export type BlockKind =
  | 'dirt'
  | 'stone'
  | 'copper'
  | 'iron'
  | 'gold'
  | 'crystal'
  | 'mithril'
  | 'obsidian'
  | 'ruby'

export type DigLayer = 'surface' | 'mid' | 'deep'

export type MineBlock = {
  id: string
  col: number
  row: number
  kind: BlockKind
  layer: DigLayer
  hp: number
  maxHp: number
  reward: number
  /** epoch ms when broken block should respawn; null if alive */
  respawnAt: number | null
}

export const LAYER_META: Record<DigLayer, { label: string; rows: number[] }> = {
  surface: { label: 'Superficie', rows: [0, 1] },
  mid: { label: 'Media', rows: [2, 3] },
  deep: { label: 'Profunda', rows: [4, 5] },
}

export function layerForRow(row: number): DigLayer {
  if (row <= 1) return 'surface'
  if (row <= 3) return 'mid'
  return 'deep'
}

export const BLOCK_META: Record<
  BlockKind,
  { label: string; color: string; hp: number; reward: number; rare?: boolean }
> = {
  dirt: { label: 'Tierra', color: '#6b4423', hp: 5, reward: 0.2 },
  stone: { label: 'Piedra', color: '#6a7078', hp: 8, reward: 0.35 },
  copper: { label: 'Cobre', color: '#c4894a', hp: 14, reward: 0.7 },
  iron: { label: 'Hierro', color: '#9aa0a6', hp: 22, reward: 1.2 },
  gold: { label: 'Oro', color: '#ffe27a', hp: 36, reward: 2.5 },
  crystal: { label: 'Cristal', color: '#4ad2ff', hp: 55, reward: 5, rare: true },
  mithril: { label: 'Mithril', color: '#b8c4ff', hp: 70, reward: 8, rare: true },
  obsidian: { label: 'Obsidiana', color: '#2a1848', hp: 90, reward: 12, rare: true },
  ruby: { label: 'Rubí', color: '#ff4a3a', hp: 110, reward: 18, rare: true },
}

/** Pesos por capa Dig — profundo = más raro */
const LAYER_WEIGHTS: Record<DigLayer, Partial<Record<BlockKind, number>>> = {
  surface: { dirt: 38, stone: 32, copper: 20, iron: 8, gold: 2 },
  mid: { stone: 22, copper: 26, iron: 28, gold: 14, crystal: 8, mithril: 2 },
  deep: { iron: 18, gold: 22, crystal: 20, mithril: 18, obsidian: 14, ruby: 8 },
}

function uid(): string {
  return `b-${Math.random().toString(36).slice(2, 9)}`
}

function rollKind(layer: DigLayer): BlockKind {
  const weights = LAYER_WEIGHTS[layer]
  const entries = Object.entries(weights) as [BlockKind, number][]
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [k, w] of entries) {
    r -= w
    if (r <= 0) return k
  }
  return entries[0]?.[0] ?? 'stone'
}

export function makeBlock(col: number, row: number, kind?: BlockKind): MineBlock {
  const layer = layerForRow(row)
  const k = kind ?? rollKind(layer)
  const meta = BLOCK_META[k] ?? BLOCK_META.stone
  return {
    id: uid(),
    col,
    row,
    kind: k,
    layer,
    hp: meta.hp,
    maxHp: meta.hp,
    reward: meta.reward,
    respawnAt: null,
  }
}

export function createMineField(): MineBlock[] {
  const blocks: MineBlock[] = []
  for (let row = 0; row < FIELD_ROWS; row++) {
    for (let col = 0; col < FIELD_COLS; col++) {
      blocks.push(makeBlock(col, row))
    }
  }
  return blocks
}

/** Normaliza bloques viejos (sin layer / kinds nuevos) */
export function normalizeMineBlocks(blocks: unknown): MineBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return createMineField()
  const out: MineBlock[] = []
  for (const raw of blocks) {
    const b = raw as Partial<MineBlock>
    if (typeof b.col !== 'number' || typeof b.row !== 'number') continue
    const layer = b.layer ?? layerForRow(b.row)
    const kind = (b.kind && b.kind in BLOCK_META ? b.kind : rollKind(layer)) as BlockKind
    const meta = BLOCK_META[kind]
    out.push({
      id: typeof b.id === 'string' ? b.id : uid(),
      col: b.col,
      row: b.row,
      kind,
      layer,
      hp: typeof b.hp === 'number' ? b.hp : meta.hp,
      maxHp: typeof b.maxHp === 'number' ? b.maxHp : meta.hp,
      reward: typeof b.reward === 'number' ? b.reward : meta.reward,
      respawnAt: b.respawnAt ?? null,
    })
  }
  if (out.length < FIELD_SIZE) return createMineField()
  return out
}

export function isAlive(b: MineBlock, now: number): boolean {
  if (b.respawnAt == null) return b.hp > 0
  return now >= b.respawnAt && b.hp > 0
}

/** Respawn expired empties; return new array if changed */
export function respawnBlocks(blocks: MineBlock[], now: number): MineBlock[] {
  let changed = false
  const next = blocks.map((b) => {
    if (b.respawnAt != null && now >= b.respawnAt) {
      changed = true
      return makeBlock(b.col, b.row)
    }
    return b
  })
  return changed ? next : blocks
}

export type BreakEvent = {
  blockId: string
  col: number
  row: number
  kind: BlockKind
  reward: number
  minerId: string
}

export type MinerPhase = 'seek' | 'walk' | 'mine'

/** Posición continua en celdas del grid (0..COLS / 0..ROWS) */
export type MinerAgent = {
  minerId: string
  x: number
  y: number
  targetId: string | null
  phase: MinerPhase
  facing: 1 | -1
  bob: number
}

const REACH = 0.48
const WALK_SPEED = 3.4 // cells / sec

export function spawnAgents(minerIds: string[], existing: MinerAgent[] = []): MinerAgent[] {
  const prev = new Map(existing.map((a) => [a.minerId, a]))
  return minerIds.map((id, i) => {
    const old = prev.get(id)
    if (old) return old
    return {
      minerId: id,
      x: 0.8 + ((i * 1.35) % (FIELD_COLS - 1)),
      y: FIELD_ROWS + 0.85 + (i % 3) * 0.12,
      targetId: null,
      phase: 'seek' as const,
      facing: 1 as const,
      bob: i * 0.37,
    }
  })
}

function blockAlive(b: MineBlock): boolean {
  return b.respawnAt == null && b.hp > 0
}

function pickTarget(
  agent: MinerAgent,
  blocks: MineBlock[],
  claimed: Set<string>,
): MineBlock | null {
  const live = blocks.filter((b) => blockAlive(b) && !claimed.has(b.id))
  if (!live.length) {
    const any = blocks.filter(blockAlive)
    if (!any.length) return null
    return any.reduce((best, b) => {
      const d = Math.hypot(b.col + 0.5 - agent.x, b.row + 0.5 - agent.y)
      const bd = Math.hypot(best.col + 0.5 - agent.x, best.row + 0.5 - agent.y)
      return d < bd ? b : best
    })
  }
  // Prefer rarer / deeper when close in distance
  return live.reduce((best, b) => {
    const d = Math.hypot(b.col + 0.5 - agent.x, b.row + 0.5 - agent.y)
    const bd = Math.hypot(best.col + 0.5 - agent.x, best.row + 0.5 - agent.y)
    const rareBoost = BLOCK_META[b.kind].rare ? -0.35 : 0
    const bestRare = BLOCK_META[best.kind].rare ? -0.35 : 0
    return d + rareBoost < bd + bestRare ? b : best
  })
}

export type EnergyDrain = { minerId: string; amount: number }

/**
 * Tick con movimiento: seek → walk → mine → siguiente.
 * energyByMiner: estamina actual; tired → lento y sin daño.
 */
export function mineTick(
  blocks: MineBlock[],
  agentsIn: MinerAgent[],
  minerIds: string[],
  damagePerMiner: number,
  now: number,
  dtSec: number,
  energyByMiner: Record<string, number> = {},
  respawnMs = 4500,
  walkTiredMult = 0.32,
): {
  blocks: MineBlock[]
  agents: MinerAgent[]
  gained: number
  events: BreakEvent[]
  drains: EnergyDrain[]
} {
  let field = respawnBlocks(blocks, now)
  const agents = spawnAgents(minerIds, agentsIn).map((a) => ({ ...a }))
  if (minerIds.length === 0) {
    return { blocks: field, agents, gained: 0, events: [], drains: [] }
  }

  const events: BreakEvent[] = []
  const drains: EnergyDrain[] = []
  let gained = 0
  const working = field.map((b) => ({ ...b }))
  const byId = new Map(working.map((b) => [b.id, b]))
  const claimed = new Set<string>()
  const dt = Math.min(0.35, Math.max(0.016, dtSec))

  for (const a of agents) {
    if (a.targetId) {
      const t = byId.get(a.targetId)
      if (t && blockAlive(t)) claimed.add(a.targetId)
      else {
        a.targetId = null
        a.phase = 'seek'
      }
    }
  }

  for (const a of agents) {
    const energy = energyByMiner[a.minerId] ?? 100
    const tired = energy <= 0
    a.bob += dt * (a.phase === 'walk' ? 14 : a.phase === 'mine' ? 18 : 6)

    let target = a.targetId ? byId.get(a.targetId) ?? null : null
    if (!target || !blockAlive(target)) {
      claimed.delete(a.targetId ?? '')
      target = pickTarget(a, working, claimed)
      a.targetId = target?.id ?? null
      if (target) claimed.add(target.id)
      a.phase = target ? 'walk' : 'seek'
    }

    if (!target) {
      a.x += Math.sin(a.bob * 0.5 + a.minerId.length) * 0.4 * dt
      a.x = Math.max(0.3, Math.min(FIELD_COLS - 0.3, a.x))
      a.phase = 'seek'
      continue
    }

    const tx = target.col + 0.5
    const ty = target.row + 0.55
    const dx = tx - a.x
    const dy = ty - a.y
    const dist = Math.hypot(dx, dy)
    const walkSpeed = WALK_SPEED * (tired ? walkTiredMult : 1)

    if (dist > REACH) {
      a.phase = 'walk'
      const step = walkSpeed * dt
      const nx = dx / dist
      const ny = dy / dist
      a.x += nx * Math.min(step, dist)
      a.y += ny * Math.min(step, dist)
      if (Math.abs(dx) > 0.05) a.facing = dx >= 0 ? 1 : -1
    } else {
      a.phase = 'mine'
      a.x = tx - a.facing * 0.12
      a.y = ty
      if (tired || damagePerMiner <= 0) {
        continue
      }
      const dmg = Math.max(0.45, damagePerMiner)
      target.hp = Math.max(0, target.hp - dmg)
      drains.push({ minerId: a.minerId, amount: dt })
      if (target.hp <= 0) {
        gained += target.reward
        events.push({
          blockId: target.id,
          col: target.col,
          row: target.row,
          kind: target.kind,
          reward: target.reward,
          minerId: a.minerId,
        })
        target.hp = 0
        target.respawnAt = now + respawnMs + Math.floor(Math.random() * 2500)
        claimed.delete(target.id)
        a.targetId = null
        a.phase = 'seek'
      }
    }
  }

  return { blocks: working, agents, gained, events, drains }
}

/** DPS from hash rate: ~rate/h → damage per tick (tickSec) */
export function damageFromRate(ratePerHour: number, tickSec: number, minerCount: number): number {
  if (minerCount <= 0) return 0
  const perMinerHour = ratePerHour / minerCount
  return Math.max(0.4, (perMinerHour / 100) * tickSec)
}
