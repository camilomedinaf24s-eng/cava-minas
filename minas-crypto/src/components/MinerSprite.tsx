import { useMemo } from 'react'
import { getRank, type RankId } from '../game/ranks'
import type { Miner } from '../game/miners'
import { minerPixelUrl } from './pixelSprites'

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
  /** Hacha equipada 1..6 — cambia look del pico */
  axeId?: number
  /** Sin pico baked (overlay externo anima el hacha) */
  omitAxe?: boolean
}

/**
 * Pixel-art miner Dig ranks 1–6 (CAVA). Flat nearest-neighbor sprites.
 */
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
  const scale = size === 'stage' ? 6 : size === 'hero' ? 5 : size === 'card' ? 5 : 4
  const src = useMemo(
    () => minerPixelUrl(rank, axe, scale, omitAxe),
    [rank, axe, scale, omitAxe],
  )

  return (
    <div
      className={`miner-sprite size-${size} rank-${rank} axe-${axe} ${digging ? 'is-digging' : ''} ${omitAxe ? 'omit-axe' : ''} ${className}`}
      data-rank={rank}
      data-axe={axe}
      title={`${def.name} · ${def.rarity} · hacha ${axe}`}
    >
      <img className="ms-px" src={src} alt="" draggable={false} />
      <div className="ms-level-tag">NIVEL {rank}</div>
      {!hideCaption && <div className="ms-skin-caption">{def.rarity}</div>}
    </div>
  )
}
