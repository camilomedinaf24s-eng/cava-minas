import { useMemo } from 'react'
import { getAxe } from '../game/axes'
import { axePixelUrl, heldPickPixelUrl } from './pixelSprites'

type Props = {
  axeId: number
  size?: 'sm' | 'lg' | 'held'
  className?: string
}

/** Pixel-art Dig axe 1–6 (`held` = pico compacto en mano) */
export function AxeSprite({ axeId, size = 'sm', className = '' }: Props) {
  const id = Math.min(6, Math.max(1, Math.floor(axeId)))
  const def = getAxe(id)
  const src = useMemo(() => {
    if (size === 'held') return heldPickPixelUrl(id, 5)
    return axePixelUrl(id, size === 'lg' ? 5 : 3)
  }, [id, size])

  return (
    <img
      className={`axe-px size-${size} ${className}`}
      src={src}
      alt={def.name}
      title={`${def.name} · ${def.rarity}`}
      draggable={false}
    />
  )
}
