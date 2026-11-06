/** Hachas Dig-style (CAVA) — ref media/ref-axes-dig.png */

export type AxeId = 1 | 2 | 3 | 4 | 5 | 6

export type AxeDef = {
  id: AxeId
  name: string
  rarity: string
  color: string
  cardBg: string
  poder: number
  velocidad: number
  extraccion: number
  durabilidad: number
  /** Precio DEMO para desbloquear (1 = starter gratis) */
  priceMine: number
  look: string
}

export const AXES: AxeDef[] = [
  {
    id: 1,
    name: 'Hacha Básica',
    rarity: 'Común',
    color: '#9aa0a6',
    cardBg: '#2a2e34',
    poder: 10,
    velocidad: 1.0,
    extraccion: 1,
    durabilidad: 100,
    priceMine: 0,
    look: 'Madera · hierro',
  },
  {
    id: 2,
    name: 'Hacha Novata',
    rarity: 'Poco Común',
    color: '#6fd97a',
    cardBg: '#1a3a20',
    poder: 20,
    velocidad: 1.2,
    extraccion: 1.5,
    durabilidad: 150,
    priceMine: 80,
    look: 'Gema verde',
  },
  {
    id: 3,
    name: 'Hacha Avanzada',
    rarity: 'Raro',
    color: '#4ad2ff',
    cardBg: '#0e2a44',
    poder: 35,
    velocidad: 1.4,
    extraccion: 2,
    durabilidad: 200,
    priceMine: 200,
    look: 'Cristal azul',
  },
  {
    id: 4,
    name: 'Hacha Experta',
    rarity: 'Épico',
    color: '#c44dff',
    cardBg: '#2a0e44',
    poder: 55,
    velocidad: 1.6,
    extraccion: 3,
    durabilidad: 300,
    priceMine: 400,
    look: 'Oro · gema púrpura',
  },
  {
    id: 5,
    name: 'Hacha Élite',
    rarity: 'Legendario',
    color: '#ffb020',
    cardBg: '#3a2008',
    poder: 75,
    velocidad: 1.8,
    extraccion: 4,
    durabilidad: 400,
    priceMine: 700,
    look: 'Cristales cian · marco oro',
  },
  {
    id: 6,
    name: 'Hacha Legendaria',
    rarity: 'Mítico',
    color: '#ff4a3a',
    cardBg: '#3a0c08',
    poder: 100,
    velocidad: 2.0,
    extraccion: 5,
    durabilidad: 500,
    priceMine: 1200,
    look: 'Alas cristal · marco mítico',
  },
]

export function getAxe(id: number): AxeDef {
  const n = Math.min(6, Math.max(1, Math.floor(id))) as AxeId
  return AXES[n - 1]
}

/**
 * Mult. de rate por hacha:
 *   minerRate × velocidad × extraccion × (1 + poder/250)
 */
export function axeRateMult(axe: AxeDef): number {
  return axe.velocidad * axe.extraccion * (1 + axe.poder / 250)
}
