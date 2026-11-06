import { useMemo } from 'react'
import { getAxe } from '../game/axes'
import { heldPickPixelUrl } from './pixelSprites'
import { DigAxeArt } from './DigAxeArt'

type Props = {
  axeId: number
  size?: 'sm' | 'lg' | 'held'
  className?: string
}

/** Dig-style axe art 1–6; `held` keeps compact pixel for swing overlay */
export function AxeSprite({ axeId, size = 'sm', className = '' }: Props) {
  const id = Math.min(6, Math.max(1, Math.floor(axeId)))
  const def = getAxe(id)
  const heldSrc = useMemo(() => heldPickPixelUrl(id, 5), [id])

  if (size === 'held') {
    return (
      <img
        className={`axe-px size-held ${className}`}
        src={heldSrc}
        alt={def.name}
        title={`${def.name} · ${def.rarity}`}
        draggable={false}
      />
    )
  }

  return (
    <div
      className={`axe-px dig-hd size-${size} ${className}`}
      title={`${def.name} · ${def.rarity}`}
      role="img"
      aria-label={def.name}
    >
      <DigAxeArt axeId={id} />
    </div>
  )
}
