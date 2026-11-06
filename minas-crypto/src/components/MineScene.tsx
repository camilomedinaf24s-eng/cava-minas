import {
  BLOCK_META,
  FIELD_COLS,
  FIELD_ROWS,
  LAYER_META,
  layerForRow,
  type MineBlock,
  type MinerAgent,
} from '../game/mineField'
import type { Miner } from '../game/miners'
import type { SkinId } from '../game/season'
import { SKINS } from '../game/season'
import { AxeSprite } from './AxeSprite'
import { MinerSprite } from './MinerSprite'

type Floater = { id: string; col: number; row: number; text: string; at: number }

type Props = {
  blocks: MineBlock[]
  crew: Miner[]
  agents: MinerAgent[]
  axeId: number
  boosted?: boolean
  floaters?: Floater[]
  now: number
  skin?: SkinId
}

const GRID_H = 78

export function MineScene({
  blocks,
  crew,
  agents,
  axeId,
  boosted,
  floaters = [],
  now,
  skin = 'default',
}: Props) {
  const byId = new Map(crew.map((m) => [m.id, m]))
  const hitIds = new Set(
    agents.filter((a) => a.phase === 'mine' && a.targetId).map((a) => a.targetId as string),
  )
  const tint = SKINS[skin]?.tint

  return (
    <div className={`mine-canvas mine-field ${boosted ? 'boosted' : ''}`} id="mine-field">
      <div className="mf-sky" />
      <div className="mf-layer-rail" aria-hidden>
        <span data-layer="surface">{LAYER_META.surface.label}</span>
        <span data-layer="mid">{LAYER_META.mid.label}</span>
        <span data-layer="deep">{LAYER_META.deep.label}</span>
      </div>
      <div
        className="mf-grid"
        style={{
          gridTemplateColumns: `repeat(${FIELD_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${FIELD_ROWS}, 1fr)`,
          height: `${GRID_H}%`,
        }}
      >
        {blocks.map((b) => {
          const alive = b.respawnAt == null && b.hp > 0
          const respawning = b.respawnAt != null && b.respawnAt > now
          const meta = BLOCK_META[b.kind] ?? BLOCK_META.stone
          const layer = b.layer ?? layerForRow(b.row)
          const pct = alive ? Math.max(0.12, b.hp / b.maxHp) : 0
          const hit = hitIds.has(b.id)
          return (
            <div
              key={b.id}
              className={`mf-block kind-${b.kind} layer-${layer} ${meta.rare ? 'is-rare' : ''} ${alive ? 'alive' : ''} ${respawning ? 'respawn' : 'empty'} ${hit ? 'is-hit' : ''}`}
              style={{
                ['--blk' as string]: meta.color,
                ['--hp' as string]: String(pct),
              }}
              title={
                alive
                  ? `${meta.label} · ${LAYER_META[layer].label} · ${b.hp.toFixed(0)}/${b.maxHp}`
                  : 'Regenerando…'
              }
            >
              <span className="mf-px" />
              {alive && meta.rare && <span className="mf-rare-tag">★</span>}
              {alive && <span className="mf-hp" />}
              {hit && (
                <>
                  <span className="mf-impact" />
                  <span className="mf-crack" />
                </>
              )}
            </div>
          )
        })}
      </div>

      {floaters.map((f) => (
        <div
          key={f.id}
          className="mf-floater"
          style={{
            left: `${((f.col + 0.5) / FIELD_COLS) * 100}%`,
            top: `${((f.row + 0.2) / FIELD_ROWS) * GRID_H}%`,
          }}
        >
          {f.text} MINE
        </div>
      ))}

      <div className="mf-agents">
        {agents.map((a) => {
          const miner = byId.get(a.minerId)
          if (!miner) return null
          const maxE = miner.maxEnergy || 100
          const energy = Math.max(0, Math.min(maxE, miner.energy ?? maxE))
          const tired = energy <= 0
          const walkBob = a.phase === 'walk' ? Math.sin(a.bob) * 3 : a.phase === 'mine' ? Math.sin(a.bob) * 1.5 : 0
          const left = (a.x / FIELD_COLS) * 100
          const top = Math.min(92, (a.y / FIELD_ROWS) * GRID_H)
          return (
            <div
              key={a.minerId}
              className={`mf-agent phase-${a.phase} face-${a.facing === 1 ? 'r' : 'l'} ${tired ? 'is-tired' : ''}`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: `translate(-50%, -82%) translateY(${walkBob}px)`,
                zIndex: 20 + Math.floor(a.y * 2),
              }}
            >
              <div className="mf-energy" title={`Energía ${Math.round(energy)}/${maxE}`}>
                <i style={{ width: `${(energy / maxE) * 100}%` }} />
              </div>
              <div
                className="mf-body"
                style={{
                  transform: `scaleX(${a.facing})`,
                  ['--skin-tint' as string]: tint,
                }}
              >
                <MinerSprite
                  miner={miner}
                  size="scene"
                  digging={false}
                  hideCaption
                  axeId={axeId}
                  omitAxe
                />
              </div>
              {!tired && (
                <div
                  className={`mf-pick ${a.phase === 'mine' ? 'swing' : 'carry'}`}
                  style={{ transform: a.facing === -1 ? 'scaleX(-1)' : undefined }}
                  aria-hidden
                >
                  <span className="mf-pick-pivot">
                    <AxeSprite axeId={axeId} size="held" />
                  </span>
                </div>
              )}
              {tired && <span className="mf-zzz">zzz</span>}
              {a.phase === 'walk' && !tired && <span className="mf-dust" />}
              {a.phase === 'mine' && !tired && <span className="mf-hit-spark" />}
            </div>
          )
        })}
      </div>

      <div className="mf-ground" />
    </div>
  )
}
