import { getRank, type RankId } from '../game/ranks'
import type { Miner } from '../game/miners'
import { DigMinerArt } from './DigMinerArt'

export function skinTier(level: number): RankId {
  return Math.min(6, Math.max(1, Math.floor(level))) as RankId
}

export function skinLabel(level: number): string {
  return getRank(level).look
}

type Props = {
  miner: Pick<Miner, 'level' | 'rarity' | 'name'>
  size?: 'scene' | 'card' | 'hero' | 'stage'
  digging?: boolean
  className?: string
  hideCaption?: boolean
  axeId?: number
  omitAxe?: boolean
}

/** Dig-style illustrated miner ranks 1–6 (CAVA). */
export function MinerSprite({
  miner,
  size = 'card',
  digging = false,
  className = '',
  hideCaption = false,
  axeId = 1,
  omitAxe = false,
}: Props) {
  const rank = skinTier(miner.level)
  const def = getRank(rank)
  const axe = Math.min(6, Math.max(1, Math.floor(axeId || 1)))

  return (
    <div
      className={`miner-sprite dig-hd size-${size} rank-${rank} axe-${axe} ${digging ? 'is-digging' : ''} ${omitAxe ? 'omit-axe' : ''} ${className}`}
      data-rank={rank}
      data-axe={axe}
      title={`${def.name} · ${def.rarity} · hacha ${axe}`}
    >
      <DigMinerArt rank={rank} axeId={axe} omitAxe={omitAxe} className="ms-dig" />
      <div className="ms-level-tag">NIVEL {rank}</div>
      {!hideCaption && <div className="ms-skin-caption">{def.rarity}</div>}
    </div>
  )
}
