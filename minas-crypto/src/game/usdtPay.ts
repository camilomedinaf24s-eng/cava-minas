/**
 * USDT payments DEMO — CAVA
 * Sin retiros BTC. Sin promesas de ganancias.
 * Listo para enganchar NOWPayments / Stripe Crypto vía env.
 */

export type UsdtProductKind = 'energy' | 'box' | 'starter' | 'season'

export type UsdtInvoice = {
  id: string
  kind: UsdtProductKind
  productId: string
  label: string
  amountUsdt: number
  /** Dirección depósito mock (TRC20 DEMO) */
  address: string
  network: 'TRC20' | 'ERC20' | 'Polygon'
  status: 'awaiting' | 'confirming' | 'paid' | 'expired'
  createdAt: number
  /** Path listo para pasarela real */
  gatewayPath: string
}

/** Dirección mock — solo DEMO, no enviar fondos reales */
export const USDT_DEMO_ADDRESS = 'TCaVaDemoUsdtPay111111111111111111'
export const USDT_DEMO_NETWORK: UsdtInvoice['network'] = 'TRC20'

export function usdtFromUsd(usd: number): number {
  // DEMO 1:1 USDT≈USD (sin tip de mercado)
  return Math.round(usd * 100) / 100
}

export function createUsdtInvoice(input: {
  kind: UsdtProductKind
  productId: string
  label: string
  amountUsd: number
}): UsdtInvoice {
  const amountUsdt = usdtFromUsd(input.amountUsd)
  const id = `usdt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    kind: input.kind,
    productId: input.productId,
    label: input.label,
    amountUsdt,
    address: USDT_DEMO_ADDRESS,
    network: USDT_DEMO_NETWORK,
    status: 'awaiting',
    createdAt: Date.now(),
    gatewayPath: `/api/payments/usdt/invoice?product=${encodeURIComponent(input.productId)}&amount=${amountUsdt}`,
  }
}

export function formatUsdt(n: number): string {
  return `${n.toFixed(2)} USDT`
}
