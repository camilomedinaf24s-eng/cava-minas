/** Stripe mock — checkout simulado → ready path real */

export type StripeProductId =
  | 'energy_basic'
  | 'energy_medium'
  | 'energy_large'
  | 'box_common'
  | 'box_rare'
  | 'box_legendary'
  | 'starter'
  | 'season_pass'

export type StripeProduct = {
  id: StripeProductId
  name: string
  priceUsd: number
  blurb: string
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  { id: 'energy_basic', name: '⚡ Energía Básico', priceUsd: 0.99, blurb: 'Recarga cap 100' },
  { id: 'energy_medium', name: '⚡ Energía Medio', priceUsd: 2.99, blurb: 'Recarga cap 180' },
  { id: 'energy_large', name: '⚡ Energía Grande', priceUsd: 6.99, blurb: 'Recarga cap 320' },
  { id: 'box_common', name: 'Caja común', priceUsd: 0.99, blurb: 'Entry Dig' },
  { id: 'box_rare', name: 'Caja rara', priceUsd: 4.99, blurb: 'Progresión' },
  { id: 'box_legendary', name: 'Caja legendaria', priceUsd: 14.99, blurb: 'High ticket' },
  { id: 'starter', name: 'Starter Pack', priceUsd: 4.99, blurb: 'Caja rara + ⚡ Medio' },
  { id: 'season_pass', name: 'Pase temporada', priceUsd: 9.99, blurb: 'Track premium 30 días' },
]

export type CheckoutSession = {
  id: string
  productId: StripeProductId
  status: 'open' | 'complete' | 'canceled'
  amountUsd: number
  createdAt: number
  /** Path listo para Stripe Checkout real */
  readyPath: string
}

export function createMockCheckout(productId: StripeProductId): CheckoutSession {
  const p = STRIPE_PRODUCTS.find((x) => x.id === productId) ?? STRIPE_PRODUCTS[0]
  const id = `cs_test_${Math.random().toString(36).slice(2, 10)}`
  return {
    id,
    productId: p.id,
    status: 'open',
    amountUsd: p.priceUsd,
    createdAt: Date.now(),
    readyPath: `/api/stripe/checkout?price=${p.id}&mode=payment`,
  }
}

export function completeMockCheckout(session: CheckoutSession): CheckoutSession {
  return { ...session, status: 'complete' }
}
