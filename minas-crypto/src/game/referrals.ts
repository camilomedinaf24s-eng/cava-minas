/** Referidos DEMO — invitar = MINE / caja */

export const REFERRAL_REWARD_MINE = 150
export const REFERRAL_REWARD_BOX = 'common' as const
export const MAX_REFERRALS = 20

export function makeReferralCode(seed: string): string {
  const base = seed.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'CAVA'
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return `CAVA-${base}${h.toString(36).toUpperCase().slice(0, 4)}`
}

export function isValidReferralCode(code: string): boolean {
  return /^CAVA-[A-Z0-9]{4,12}$/i.test(code.trim())
}
