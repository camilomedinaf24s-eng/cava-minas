/**
 * Pasarela USDT — DEMO por defecto; NOWPayments cuando VITE_PAYMENTS_MODE=nowpayments.
 * Secrets solo en server (ver docs/usdt-pagos.md + .env.example).
 */

import { createNowPaymentsInvoice, pollNowPaymentsStatus } from './nowpayments'

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

/** True mientras no haya pasarela live configurada */
export function isPaymentsDemo(): boolean {
  return readPaymentsMode() === 'demo'
}

export async function createUsdtPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  const mode = readPaymentsMode()

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
    // Fallback seguro: no cobrar on-chain sin keys
    return {
      ...live,
      message: `${live.message} · UI permanece en DEMO hasta secrets`,
    }
  }

  if (mode === 'stripe_crypto') {
    if (!env('VITE_STRIPE_PUBLISHABLE_KEY')) {
      return {
        ok: false,
        mode,
        paymentId: '',
        message: 'Falta VITE_STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY en server',
      }
    }
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
  if (readPaymentsMode() === 'nowpayments') return pollNowPaymentsStatus(paymentId)
  return 'pending'
}

export const PAYMENTS_ENV_KEYS = [
  'VITE_PAYMENTS_MODE',
  'VITE_PAYMENTS_API_BASE',
  'NOWPAYMENTS_API_KEY',
  'NOWPAYMENTS_IPN_SECRET',
  'NOWPAYMENTS_IPN_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_CRYPTO_WEBHOOK_SECRET',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'USDT_RECEIVE_ADDRESS',
] as const
