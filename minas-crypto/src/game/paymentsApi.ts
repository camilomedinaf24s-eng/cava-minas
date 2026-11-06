/**
 * Stub pasarela crypto (NOWPayments / Stripe Crypto).
 * En DEMO no llama red real. Con env keys → listo para wire.
 *
 * Env (documentadas en docs/usdt-pagos.md):
 * - VITE_PAYMENTS_MODE = demo | nowpayments | stripe_crypto
 * - VITE_NOWPAYMENTS_API_KEY (solo si hace falta en client; preferir server)
 * - VITE_STRIPE_PUBLISHABLE_KEY
 * Server-only (no bundle): NOWPAYMENTS_API_KEY, STRIPE_SECRET_KEY, USDT_RECEIVE_ADDRESS
 */

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

function readMode(): PaymentsMode {
  const raw = env('VITE_PAYMENTS_MODE') || 'demo'
  if (raw === 'nowpayments' || raw === 'stripe_crypto') return raw
  return 'demo'
}

/**
 * Crea pago USDT. En demo: respuesta simulada.
 * En nowpayments/stripe_crypto: stub (sin secrets server → mensaje explícito).
 */
export async function createUsdtPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  const mode = readMode()

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
    if (!env('VITE_NOWPAYMENTS_API_KEY')) {
      return {
        ok: false,
        mode,
        paymentId: '',
        message: 'Falta key: usar API route server con NOWPAYMENTS_API_KEY (ver usdt-pagos.md)',
      }
    }
    return {
      ok: false,
      mode,
      paymentId: '',
      message: 'Stub NOWPayments: cablear fetch server-side (ver docs/usdt-pagos.md)',
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

/** Poll estado — DEMO siempre paid tras confirmación UI */
export async function getUsdtPaymentStatus(paymentId: string): Promise<'pending' | 'paid' | 'failed'> {
  if (paymentId.startsWith('demo_')) return 'paid'
  return 'pending'
}

export const PAYMENTS_ENV_KEYS = [
  'VITE_PAYMENTS_MODE',
  'NOWPAYMENTS_API_KEY',
  'NOWPAYMENTS_IPN_SECRET',
  'VITE_NOWPAYMENTS_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_CRYPTO_WEBHOOK_SECRET',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'USDT_RECEIVE_ADDRESS',
] as const
