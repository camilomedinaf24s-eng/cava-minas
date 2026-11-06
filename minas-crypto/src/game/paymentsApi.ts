/**
 * Pasarela USDT — DEMO por defecto; NOWPayments cuando keys en server o VITE_PAYMENTS_MODE.
 * Secrets solo en server (docs/usdt-pagos.md).
 */

import {
  createNowPaymentsInvoice,
  fetchPaymentsConfig,
  pollNowPaymentsStatus,
  resolveLivePaymentsMode,
} from './nowpayments'

export type PaymentsMode = 'demo' | 'nowpayments' | 'stripe_crypto'

export type CreatePaymentRequest = {
  productId: string
  amountUsdt: number
  orderId: string
  successUrl?: string
  cancelUrl?: string
}

export type CreatePaymentResponse = {
  ok: boolean
  mode: PaymentsMode
  paymentId: string
  payAddress?: string
  payAmount?: number
  checkoutUrl?: string
  message: string
}

function env(name: string): string | undefined {
  const v = (import.meta.env as Record<string, string | undefined>)[name]
  return v && String(v).length ? String(v) : undefined
}

/** Solo bake-time (puede quedar demo aunque el host ya tenga keys) */
export function readPaymentsMode(): PaymentsMode {
  const raw = env('VITE_PAYMENTS_MODE') || 'demo'
  if (raw === 'nowpayments' || raw === 'stripe_crypto') return raw
  return 'demo'
}

/** Sync hint — usar resolvePaymentsLive() para verdad del host */
export function isPaymentsDemo(): boolean {
  return readPaymentsMode() === 'demo'
}

export async function resolvePaymentsLive(): Promise<{
  mode: PaymentsMode
  demo: boolean
  ready: boolean
}> {
  const mode = await resolveLivePaymentsMode()
  const cfg = await fetchPaymentsConfig()
  return { mode, demo: mode === 'demo', ready: cfg.ready }
}

export async function createUsdtPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  const mode = await resolveLivePaymentsMode()

  if (mode === 'demo') {
    return {
      ok: true,
      mode: 'demo',
      paymentId: `demo_${req.orderId}`,
      payAddress: 'TCaVaDemoUsdtPay111111111111111111',
      payAmount: req.amountUsdt,
      message: 'DEMO · confirmación simulada (no on-chain)',
    }
  }

  if (mode === 'nowpayments') {
    const live = await createNowPaymentsInvoice(req)
    if (live.ok) return live
    // Fallback seguro: no cobrar on-chain sin keys/route
    return {
      ok: true,
      mode: 'demo',
      paymentId: `demo_${req.orderId}`,
      payAddress: 'TCaVaDemoUsdtPay111111111111111111',
      payAmount: req.amountUsdt,
      message: `${live.message} · fallback DEMO`,
    }
  }

  if (mode === 'stripe_crypto') {
    return {
      ok: false,
      mode,
      paymentId: '',
      message: 'Stub Stripe Crypto: cablear Checkout Session (ver docs/usdt-pagos.md)',
    }
  }

  return { ok: false, mode: 'demo', paymentId: '', message: 'Modo desconocido' }
}

export async function getUsdtPaymentStatus(paymentId: string): Promise<'pending' | 'paid' | 'failed'> {
  if (paymentId.startsWith('demo_')) return 'paid'
  return pollNowPaymentsStatus(paymentId)
}

const GRANTED_KEY = 'cava-usdt-granted-v1'

export function wasPaymentGranted(paymentId: string): boolean {
  try {
    const raw = localStorage.getItem(GRANTED_KEY)
    if (!raw) return false
    const list = JSON.parse(raw) as string[]
    return Array.isArray(list) && list.includes(paymentId)
  } catch {
    return false
  }
}

export function markPaymentGranted(paymentId: string): void {
  try {
    const raw = localStorage.getItem(GRANTED_KEY)
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : []
    if (!list.includes(paymentId)) {
      list.push(paymentId)
      localStorage.setItem(GRANTED_KEY, JSON.stringify(list.slice(-80)))
    }
  } catch {
    /* ignore */
  }
}

export const PAYMENTS_ENV_KEYS = [
  'VITE_PAYMENTS_MODE',
  'VITE_PAYMENTS_API_BASE',
  'NOWPAYMENTS_API_KEY',
  'NOWPAYMENTS_IPN_SECRET',
  'NOWPAYMENTS_IPN_URL',
] as const
