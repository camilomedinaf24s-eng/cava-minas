/**
 * USDT payments — CAVA
 * Sin retiros BTC. Sin promesas de ganancias.
 * DEMO mock o invoice NOWPayments vía /api/payments/usdt/*
 */

export type UsdtProductKind = 'energy' | 'box' | 'starter' | 'season'

export type UsdtNetwork = 'TRC20' | 'ERC20' | 'Polygon' | 'BEP20' | 'USDT'

export type UsdtInvoice = {
  id: string
  kind: UsdtProductKind
  productId: string
  label: string
  amountUsdt: number
  address: string
  network: UsdtNetwork
  status: 'awaiting' | 'confirming' | 'paid' | 'expired'
  createdAt: number
  gatewayPath: string
  /** NOWPayments payment_id (live) */
  paymentId?: string
  checkoutUrl?: string
  payCurrency?: string
  payinExtraId?: string
  live?: boolean
  message?: string
}

/** Dirección mock — solo DEMO, no enviar fondos reales */
export const USDT_DEMO_ADDRESS = 'TCaVaDemoUsdtPay111111111111111111'
export const USDT_DEMO_NETWORK: UsdtInvoice['network'] = 'TRC20'

export function usdtFromUsd(usd: number): number {
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
    gatewayPath: `/api/payments/usdt/create`,
    live: false,
    message: 'DEMO',
  }
}

export function formatUsdt(n: number): string {
  return `${n.toFixed(2)} USDT`
}

export function formatPayAmount(amount: number, payCurrency?: string): string {
  const c = (payCurrency || 'USDT').toUpperCase()
  const fixed = amount >= 1 ? amount.toFixed(2) : amount.toFixed(6)
  return `${fixed} ${c}`
}
