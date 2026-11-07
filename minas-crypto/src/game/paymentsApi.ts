/**
 * Pasarela USDT — LIVE cuando /api/payments/usdt/config.ready.
 * Nunca otorga ítem DEMO si el usuario pidió USDT live y create falló.
 */

import {
  bustPaymentsConfigCache,
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

export function readPaymentsMode(): PaymentsMode {
  const raw = env('VITE_PAYMENTS_MODE') || 'demo'
  if (raw === 'nowpayments' || raw === 'stripe_crypto') return raw
  return 'demo'
}

export function isPaymentsDemo(): boolean {
  return readPaymentsMode() === 'demo'
}

export async function resolvePaymentsLive(): Promise<{
  mode: PaymentsMode
  demo: boolean
  ready: boolean
  message?: string
}> {
  bustPaymentsConfigCache()
  const cfg = await fetchPaymentsConfig()
  const mode = await resolveLivePaymentsMode()
  return { mode, demo: !cfg.ready, ready: cfg.ready, message: cfg.message }
}

/**
 * Create payment.
 * - ready → NOWPayments only (ok:false on failure — NO silent DEMO grant)
 * - !ready → DEMO mock invoice (Ya pagué path)
 */
export async function createUsdtPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  bustPaymentsConfigCache()
  const cfg = await fetchPaymentsConfig()

  if (cfg.ready) {
    const live = await createNowPaymentsInvoice(req)
    if (live.ok && live.paymentId && !live.paymentId.startsWith('demo_')) return live
    return {
      ok: false,
      mode: 'nowpayments',
      paymentId: '',
      message: live.message || 'NOWPayments create failed · sin grant DEMO',
    }
  }

  // Explicit DEMO — secrets not on host / routes not mounted
  return {
    ok: true,
    mode: 'demo',
    paymentId: `demo_${req.orderId}`,
    payAddress: 'TCaVaDemoUsdtPay111111111111111111',
    payAmount: req.amountUsdt,
    message: cfg.message
      ? `DEMO · ${cfg.message}`
      : 'DEMO · bind NOWPAYMENTS_API_KEY (+ IPN) y republish',
  }
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
