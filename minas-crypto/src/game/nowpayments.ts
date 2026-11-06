/**
 * NOWPayments USDT — client hooks listos para API real.
 * DEMO hasta que existan secrets (NOWPAYMENTS_API_KEY en server).
 *
 * Flujo real:
 * 1) POST /api/payments/usdt/create  { productId, amountUsdt, orderId }
 * 2) Server usa NOWPAYMENTS_API_KEY → api.nowpayments.io/v1/payment
 * 3) IPN webhook con NOWPAYMENTS_IPN_SECRET → grant ítem
 */

import type { CreatePaymentRequest, CreatePaymentResponse, PaymentsMode } from './paymentsApi'

export const NOWPAYMENTS_API_BASE = 'https://api.nowpayments.io/v1'
export const NOWPAYMENTS_CREATE_PATH = '/api/payments/usdt/create'
export const NOWPAYMENTS_STATUS_PATH = '/api/payments/usdt/status'

export type NowPaymentsCreateBody = CreatePaymentRequest & {
  payCurrency?: 'usdttrc20' | 'usdterc20' | 'usdtmatic'
}

function clientMode(): PaymentsMode {
  const raw = (import.meta.env.VITE_PAYMENTS_MODE as string | undefined) || 'demo'
  if (raw === 'nowpayments' || raw === 'stripe_crypto') return raw
  return 'demo'
}

/** True si el front cree que hay pasarela (solo señal; secrets van en server) */
export function nowPaymentsConfiguredClient(): boolean {
  return clientMode() === 'nowpayments' && Boolean(import.meta.env.VITE_PAYMENTS_API_BASE)
}

/**
 * Crea invoice USDT vía API route del host.
 * Sin secrets en browser. Si falla / no hay route → ok:false (UI queda en DEMO).
 */
export async function createNowPaymentsInvoice(
  req: NowPaymentsCreateBody,
): Promise<CreatePaymentResponse> {
  const base = (import.meta.env.VITE_PAYMENTS_API_BASE as string | undefined) || ''
  const url = `${base.replace(/\/$/, '')}${NOWPAYMENTS_CREATE_PATH}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...req,
        payCurrency: req.payCurrency ?? 'usdttrc20',
      }),
    })
    if (!res.ok) {
      return {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: `NOWPayments API ${res.status} — revisa keys / route (docs/usdt-pagos.md)`,
      }
    }
    const data = (await res.json()) as Partial<CreatePaymentResponse> & {
      pay_address?: string
      pay_amount?: number
      payment_id?: string
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
  const base = (import.meta.env.VITE_PAYMENTS_API_BASE as string | undefined) || ''
  try {
    const res = await fetch(
      `${base.replace(/\/$/, '')}${NOWPAYMENTS_STATUS_PATH}?id=${encodeURIComponent(paymentId)}`,
    )
    if (!res.ok) return 'pending'
    const data = (await res.json()) as { status?: string }
    const s = (data.status || '').toLowerCase()
    if (s === 'finished' || s === 'confirmed' || s === 'paid') return 'paid'
    if (s === 'failed' || s === 'expired' || s === 'refunded') return 'failed'
    return 'pending'
  } catch {
    return 'pending'
  }
}

/** Plantilla server (comentada) — copiar a host serverless */
export const NOWPAYMENTS_SERVER_STUB = `
// POST /api/payments/usdt/create
// const key = process.env.NOWPAYMENTS_API_KEY
// const r = await fetch('https://api.nowpayments.io/v1/payment', {
//   method: 'POST',
//   headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
//   body: JSON.stringify({
//     price_amount: body.amountUsdt,
//     price_currency: 'usd',
//     pay_currency: 'usdttrc20',
//     order_id: body.orderId,
//     order_description: body.productId,
//     ipn_callback_url: process.env.NOWPAYMENTS_IPN_URL,
//   }),
// })
`
