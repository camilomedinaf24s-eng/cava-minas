import { getAxe } from '../game/axes'
import { DigAxeArt } from './DigAxeArt'

type Props = {
  axeId: number
  size?: 'sm' | 'lg' | 'held'
  className?: string
}

/** Dig HD axe — held also uses SVG so the pick is always visible */
export function AxeSprite({ axeId, size = 'sm', className = '' }: Props) {
  const id = Math.min(6, Math.max(1, Math.floor(axeId)))
  const def = getAxe(id)

  return (
    <div
      className={`axe-px dig-hd size-${size} ${className}`}
      title={`${def.name} · ${def.rarity}`}
      role="img"
      aria-label={def.name}
      data-axe={id}
    >
      <DigAxeArt axeId={id} compact={size === 'held'} />
    </div>
  )
}
