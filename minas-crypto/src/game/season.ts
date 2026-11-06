/** Pase temporada + skins DEMO */

export type SkinId = 'default' | 'ember' | 'frost' | 'mythic' | 'cava_gold'

export type SeasonReward = {
  tier: number
  xpNeed: number
  free: { kind: 'mine' | 'skin' | 'energy'; value: string | number; label: string }
  premium: { kind: 'mine' | 'skin' | 'box' | 'energy'; value: string | number; label: string }
}

export const SEASON = {
  id: 's1-cava',
  name: 'Temporada 1 · Cava Deep',
  daysLeft: 22,
  priceUsd: 9.99,
} as const

export const SKINS: Record<
  SkinId,
  { name: string; tint: string; blurb: string }
> = {
  default: { name: 'Clásico', tint: '#cfc4b4', blurb: 'Skin base CAVA' },
  ember: { name: 'Ember', tint: '#ff6a3a', blurb: 'Pase free T3' },
  frost: { name: 'Frost', tint: '#4ad2ff', blurb: 'Pase premium T2' },
  mythic: { name: 'Mítico', tint: '#c44dff', blurb: 'Pase premium T5' },
  cava_gold: { name: 'CAVA Gold', tint: '#ffe27a', blurb: 'Pase premium T8' },
}

export const SEASON_TRACK: SeasonReward[] = [
  { tier: 1, xpNeed: 0, free: { kind: 'mine', value: 50, label: '50 MINE' }, premium: { kind: 'mine', value: 150, label: '150 MINE' } },
  { tier: 2, xpNeed: 40, free: { kind: 'energy', value: 'basic', label: '⚡ Básico' }, premium: { kind: 'skin', value: 'frost', label: 'Skin Frost' } },
  { tier: 3, xpNeed: 90, free: { kind: 'skin', value: 'ember', label: 'Skin Ember' }, premium: { kind: 'box', value: 'common', label: 'Caja común' } },
  { tier: 4, xpNeed: 150, free: { kind: 'mine', value: 100, label: '100 MINE' }, premium: { kind: 'energy', value: 'medium', label: '⚡ Medio' } },
  { tier: 5, xpNeed: 220, free: { kind: 'mine', value: 120, label: '120 MINE' }, premium: { kind: 'skin', value: 'mythic', label: 'Skin Mítico' } },
  { tier: 6, xpNeed: 300, free: { kind: 'energy', value: 'medium', label: '⚡ Medio' }, premium: { kind: 'box', value: 'rare', label: 'Caja rara' } },
  { tier: 7, xpNeed: 400, free: { kind: 'mine', value: 200, label: '200 MINE' }, premium: { kind: 'mine', value: 500, label: '500 MINE' } },
  { tier: 8, xpNeed: 520, free: { kind: 'mine', value: 250, label: '250 MINE' }, premium: { kind: 'skin', value: 'cava_gold', label: 'CAVA Gold' } },
]

export function seasonTierFromXp(xp: number): number {
  let t = 1
  for (const row of SEASON_TRACK) {
    if (xp >= row.xpNeed) t = row.tier
  }
  return t
}
