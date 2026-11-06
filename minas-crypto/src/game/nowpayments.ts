/**
 * NOWPayments USDT — client hooks.
 * DEMO hasta que el server tenga secrets (config.ready) o VITE_PAYMENTS_MODE=nowpayments.
 */

import type { CreatePaymentRequest, CreatePaymentResponse, PaymentsMode } from './paymentsApi'

export const NOWPAYMENTS_CREATE_PATH = '/api/payments/usdt/create'
export const NOWPAYMENTS_STATUS_PATH = '/api/payments/usdt/status'
export const NOWPAYMENTS_CONFIG_PATH = '/api/payments/usdt/config'

export type NowPaymentsCreateBody = CreatePaymentRequest & {
  payCurrency?: 'usdttrc20' | 'usdterc20' | 'usdtmatic'
}

function apiBase(): string {
  return ((import.meta.env.VITE_PAYMENTS_API_BASE as string | undefined) || '').replace(/\/$/, '')
}

function url(path: string): string {
  return `${apiBase()}${path}`
}

function bakedMode(): PaymentsMode {
  const raw = (import.meta.env.VITE_PAYMENTS_MODE as string | undefined) || 'demo'
  if (raw === 'nowpayments' || raw === 'stripe_crypto') return raw
  return 'demo'
}

let cachedReady: boolean | null = null
let readyFetchedAt = 0

/** Consulta si el host tiene keys (sin filtrar secrets) */
export async function fetchPaymentsConfig(): Promise<{ ready: boolean; mode: PaymentsMode }> {
  const now = Date.now()
  if (cachedReady != null && now - readyFetchedAt < 60_000) {
    return { ready: cachedReady, mode: cachedReady ? 'nowpayments' : bakedMode() }
  }
  try {
    const res = await fetch(url(NOWPAYMENTS_CONFIG_PATH), { cache: 'no-store' })
    if (!res.ok) {
      cachedReady = false
      readyFetchedAt = now
      return { ready: false, mode: bakedMode() }
    }
    const data = (await res.json()) as { ready?: boolean; mode?: string }
    cachedReady = Boolean(data.ready)
    readyFetchedAt = now
    return {
      ready: cachedReady,
      mode: cachedReady ? 'nowpayments' : bakedMode(),
    }
  } catch {
    cachedReady = false
    readyFetchedAt = now
    return { ready: false, mode: bakedMode() }
  }
}

/** Live si VITE_MODE=nowpayments O el server reporta keys listas */
export async function resolveLivePaymentsMode(): Promise<PaymentsMode> {
  if (bakedMode() === 'nowpayments') {
    const cfg = await fetchPaymentsConfig()
    // Mode pedido pero sin keys → DEMO fallback
    return cfg.ready ? 'nowpayments' : 'demo'
  }
  if (bakedMode() === 'stripe_crypto') return 'stripe_crypto'
  // VITE demo: auto-flip si secrets bound en host
  const cfg = await fetchPaymentsConfig()
  return cfg.ready ? 'nowpayments' : 'demo'
}

export function nowPaymentsConfiguredClient(): boolean {
  return bakedMode() === 'nowpayments' || cachedReady === true
}

export async function createNowPaymentsInvoice(
  req: NowPaymentsCreateBody,
): Promise<CreatePaymentResponse> {
  try {
    const res = await fetch(url(NOWPAYMENTS_CREATE_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...req,
        payCurrency: req.payCurrency ?? 'usdttrc20',
      }),
    })
    const data = (await res.json().catch(() => ({}))) as Partial<CreatePaymentResponse> & {
      pay_address?: string
      pay_amount?: number
      payment_id?: string
      message?: string
    }
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: data.message || `NOWPayments API ${res.status} — DEMO fallback`,
      }
    }
    return {
      ok: true,
      mode: 'nowpayments',
      paymentId: String(data.paymentId ?? data.payment_id ?? ''),
      payAddress: data.payAddress ?? data.pay_address,
      payAmount: data.payAmount ?? data.pay_amount,
      checkoutUrl: data.checkoutUrl,
      message: data.message ?? 'Invoice NOWPayments creada',
    }
  } catch {
    return {
      ok: false,
      mode: 'nowpayments',
      paymentId: '',
      message: 'Sin API route — modo DEMO hasta configurar secrets',
    }
  }
}

export async function pollNowPaymentsStatus(paymentId: string): Promise<'pending' | 'paid' | 'failed'> {
  try {
    const res = await fetch(
      `${url(NOWPAYMENTS_STATUS_PATH)}?id=${encodeURIComponent(paymentId)}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return 'pending'
    const data = (await res.json()) as { status?: string; paid?: boolean }
    if (data.paid) return 'paid'
    const s = (data.status || '').toLowerCase()
    if (s === 'finished' || s === 'confirmed' || s === 'paid') return 'paid'
    if (s === 'failed' || s === 'expired' || s === 'refunded') return 'failed'
    return 'pending'
  } catch {
    return 'pending'
  }
}
