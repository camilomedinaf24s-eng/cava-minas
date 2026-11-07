/**
 * NOWPayments USDT — client hooks (Next.js + publish-app).
 * DEMO solo si el server NO tiene keys. Si ready=true, create real (sin grant DEMO).
 */

import type { CreatePaymentRequest, CreatePaymentResponse, PaymentsMode } from './paymentsApi'

export const NOWPAYMENTS_CREATE_PATH = '/api/payments/usdt/create'
export const NOWPAYMENTS_STATUS_PATH = '/api/payments/usdt/status'
export const NOWPAYMENTS_CONFIG_PATH = '/api/payments/usdt/config'
export const NOWPAYMENTS_REDEEM_PATH = '/api/payments/usdt/redeem'

export type NowPaymentsCreateBody = CreatePaymentRequest & {
  payCurrency?: 'usdttrc20' | 'usdterc20' | 'usdtmatic'
}

export type PaymentStatusResult = {
  status: 'pending' | 'paid' | 'failed'
  paid: boolean
  grantToken?: string
  productId?: string
  kind?: 'energy' | 'box'
  amountUsdt?: number
  orderId?: string
  paymentId?: string
  message?: string
}

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_PAYMENTS_API_BASE ||
    process.env.VITE_PAYMENTS_API_BASE ||
    ''
  ).replace(/\/$/, '')
}

function url(path: string): string {
  return `${apiBase()}${path}`
}

function bakedMode(): PaymentsMode {
  const raw =
    process.env.NEXT_PUBLIC_PAYMENTS_MODE || process.env.VITE_PAYMENTS_MODE || 'demo'
  if (raw === 'nowpayments' || raw === 'stripe_crypto') return raw
  return 'demo'
}

let cachedReady: boolean | null = null
let readyFetchedAt = 0

function looksLikeJsonResponse(res: Response, text: string): boolean {
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  if (ct.includes('application/json')) return true
  const t = text.trim()
  return t.startsWith('{') || t.startsWith('[')
}

/** Consulta si el host tiene keys (sin filtrar secrets) */
export async function fetchPaymentsConfig(): Promise<{
  ready: boolean
  mode: PaymentsMode
  hasApiKey?: boolean
  hasIpnSecret?: boolean
  message?: string
}> {
  const now = Date.now()
  if (cachedReady != null && now - readyFetchedAt < 30_000) {
    return { ready: cachedReady, mode: cachedReady ? 'nowpayments' : 'demo' }
  }
  try {
    const res = await fetch(url(NOWPAYMENTS_CONFIG_PATH), {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    const text = await res.text()
    if (!res.ok || !looksLikeJsonResponse(res, text)) {
      cachedReady = false
      readyFetchedAt = now
      return {
        ready: false,
        mode: 'demo',
        message: 'config no-JSON · API route ausente o gate HTML',
      }
    }
    const data = JSON.parse(text) as {
      ready?: boolean
      hasApiKey?: boolean
      hasIpnSecret?: boolean
      message?: string
      error?: string
    }
    if (data.error === 'sign_in_required') {
      cachedReady = false
      readyFetchedAt = now
      return { ready: false, mode: 'demo', message: 'sign_in_required' }
    }
    cachedReady = Boolean(data.ready)
    readyFetchedAt = now
    return {
      ready: cachedReady,
      mode: cachedReady ? 'nowpayments' : 'demo',
      hasApiKey: data.hasApiKey,
      hasIpnSecret: data.hasIpnSecret,
      message: data.message,
    }
  } catch {
    cachedReady = false
    readyFetchedAt = now
    return { ready: false, mode: 'demo', message: 'config fetch failed' }
  }
}

export function bustPaymentsConfigCache(): void {
  cachedReady = null
  readyFetchedAt = 0
}

export async function resolveLivePaymentsMode(): Promise<PaymentsMode> {
  const cfg = await fetchPaymentsConfig()
  if (cfg.ready) return 'nowpayments'
  if (bakedMode() === 'stripe_crypto') return 'stripe_crypto'
  return 'demo'
}

export function nowPaymentsConfiguredClient(): boolean {
  return cachedReady === true
}

export async function createNowPaymentsInvoice(
  req: NowPaymentsCreateBody,
): Promise<CreatePaymentResponse> {
  try {
    const res = await fetch(url(NOWPAYMENTS_CREATE_PATH), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: req.productId,
        payCurrency: req.payCurrency ?? 'usdttrc20',
        successUrl: req.successUrl,
        cancelUrl: req.cancelUrl,
        // amountUsdt / orderId ignored server-side (catalog + cava_ orderId)
      }),
    })
    const text = await res.text()
    if (!looksLikeJsonResponse(res, text)) {
      return {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: 'API create devolvió HTML · routes no montadas o sign-in',
      }
    }
    const data = JSON.parse(text) as Partial<CreatePaymentResponse> & {
      pay_address?: string
      pay_amount?: number
      payment_id?: string
      pay_currency?: string
      payin_extra_id?: string
      message?: string
      error?: string
      ok?: boolean
    }
    if (data.error === 'sign_in_required') {
      return {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: 'sign_in_required · abre cava firmado',
      }
    }
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: data.message || `NOWPayments create ${res.status}`,
      }
    }
    const paymentId = String(data.paymentId ?? data.payment_id ?? '')
    const payAddress = String(data.payAddress ?? data.pay_address ?? '').trim()
    if (!paymentId || paymentId.startsWith('demo_')) {
      return {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: 'Create sin paymentId real',
      }
    }
    // In-app copy requires address — reject hosted-only / blank widget responses
    if (!payAddress) {
      return {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: data.message || 'Create sin pay_address · no uses checkout vacío',
      }
    }
    return {
      ok: true,
      mode: 'nowpayments',
      paymentId,
      orderId: data.orderId,
      productId: data.productId,
      kind: data.kind,
      amountUsdt: data.amountUsdt,
      payAddress,
      payAmount: data.payAmount ?? data.pay_amount,
      payCurrency: data.payCurrency ?? data.pay_currency,
      network: data.network,
      payinExtraId: data.payinExtraId ?? data.payin_extra_id,
      checkoutUrl: data.checkoutUrl,
      message: data.message ?? 'Pago USDT listo · copia la dirección',
    }
  } catch {
    return {
      ok: false,
      mode: 'nowpayments',
      paymentId: '',
      message: 'Create fetch failed',
    }
  }
}

export async function pollNowPaymentsStatus(paymentId: string): Promise<PaymentStatusResult> {
  try {
    const res = await fetch(
      `${url(NOWPAYMENTS_STATUS_PATH)}?id=${encodeURIComponent(paymentId)}`,
      { cache: 'no-store', credentials: 'same-origin' },
    )
    const text = await res.text()
    if (!res.ok || !looksLikeJsonResponse(res, text)) {
      return { status: 'pending', paid: false, message: 'status non-JSON' }
    }
    const data = JSON.parse(text) as {
      status?: string
      paid?: boolean
      grantToken?: string
      grantRedeemed?: boolean
      productId?: string
      kind?: 'energy' | 'box'
      amountUsdt?: number
      orderId?: string
      paymentId?: string
      message?: string
    }
    if (data.paid === true && data.grantToken) {
      return {
        status: 'paid',
        paid: true,
        grantToken: data.grantToken,
        productId: data.productId,
        kind: data.kind,
        amountUsdt: data.amountUsdt,
        orderId: data.orderId,
        paymentId: data.paymentId || paymentId,
        message: data.message,
      }
    }
    // Already redeemed — do not re-grant
    if (data.paid === true && data.grantRedeemed) {
      return { status: 'failed', paid: false, message: 'grant already redeemed' }
    }
    // paid without grant → wait (binding/IPN)
    if (data.paid === true && !data.grantToken) {
      return { status: 'pending', paid: false, message: 'paid awaiting grant' }
    }
    const s = (data.status || '').toLowerCase()
    if (s === 'failed' || s === 'expired' || s === 'refunded') {
      return { status: 'failed', paid: false, message: data.message }
    }
    return { status: 'pending', paid: false, message: data.message }
  } catch {
    return { status: 'pending', paid: false, message: 'status fetch failed' }
  }
}

export async function redeemUsdtGrant(grantToken: string): Promise<{
  ok: boolean
  productId?: string
  kind?: 'energy' | 'box'
  amountUsdt?: number
  orderId?: string
  paymentId?: string
  message?: string
}> {
  try {
    const res = await fetch(url(NOWPAYMENTS_REDEEM_PATH), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grantToken }),
    })
    const text = await res.text()
    if (!looksLikeJsonResponse(res, text)) {
      return { ok: false, message: 'redeem non-JSON' }
    }
    const data = JSON.parse(text) as {
      ok?: boolean
      productId?: string
      kind?: 'energy' | 'box'
      amountUsdt?: number
      orderId?: string
      paymentId?: string
      message?: string
    }
    if (!res.ok || !data.ok) {
      return { ok: false, message: data.message || `redeem ${res.status}` }
    }
    return {
      ok: true,
      productId: data.productId,
      kind: data.kind,
      amountUsdt: data.amountUsdt,
      orderId: data.orderId,
      paymentId: data.paymentId,
    }
  } catch {
    return { ok: false, message: 'redeem fetch failed' }
  }
}
