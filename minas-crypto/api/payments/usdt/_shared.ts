/**
 * Shared NOWPayments helpers — server only.
 * Never import from client/Vite bundle.
 */

export const NP_API = 'https://api.nowpayments.io/v1'

export type CatalogProduct = {
  productId: string
  kind: 'energy' | 'box'
  amountUsdt: number
  label: string
}

/** Precios shop (1 USDT ≈ 1 USD) — no confiar solo en el client */
export const PRODUCT_CATALOG: Record<string, CatalogProduct> = {
  basic: { productId: 'basic', kind: 'energy', amountUsdt: 0.99, label: '⚡ Pack Básico' },
  medium: { productId: 'medium', kind: 'energy', amountUsdt: 2.99, label: '⚡ Pack Medio' },
  large: { productId: 'large', kind: 'energy', amountUsdt: 6.99, label: '⚡ Pack Grande' },
  common: { productId: 'common', kind: 'box', amountUsdt: 0.99, label: 'Caja común' },
  rare: { productId: 'rare', kind: 'box', amountUsdt: 4.99, label: 'Caja rara' },
  legendary: { productId: 'legendary', kind: 'box', amountUsdt: 14.99, label: 'Caja legendaria' },
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

export function getApiKey(): string | undefined {
  const k = process.env.NOWPAYMENTS_API_KEY
  return k && k.length > 8 ? k : undefined
}

export function getIpnSecret(): string | undefined {
  const k = process.env.NOWPAYMENTS_IPN_SECRET
  return k && k.length > 4 ? k : undefined
}

export function secretsReady(): boolean {
  return Boolean(getApiKey())
}

export function resolveProduct(productId: string, amountUsdt?: number): CatalogProduct | null {
  const p = PRODUCT_CATALOG[productId]
  if (!p) return null
  if (typeof amountUsdt === 'number' && Math.abs(amountUsdt - p.amountUsdt) > 0.02) {
    // Client amount mismatch — use catalog (anti-tamper)
    return p
  }
  return p
}

export function ipnCallbackUrl(request: Request): string {
  const fromEnv = process.env.NOWPAYMENTS_IPN_URL
  if (fromEnv && /^https:\/\//i.test(fromEnv)) return fromEnv.replace(/\/$/, '')
  const origin = new URL(request.url).origin
  return `${origin}/api/payments/usdt/ipn`
}

/** Recursive key sort for NOWPayments IPN HMAC */
export function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortObject(obj[key])
    }
    return out
  }
  return value
}

export async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyNowPaymentsIpn(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return false
  }
  const sorted = JSON.stringify(sortObject(parsed))
  const expected = await hmacSha512Hex(secret, sorted)
  // timing-safe-ish compare
  if (expected.length !== signatureHeader.length) return false
  let ok = 0
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
  }
  return ok === 0
}

export function isPaidStatus(status: string | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s === 'finished' || s === 'confirmed' || s === 'paid'
}

export function normalizeStatus(status: string | undefined): 'pending' | 'paid' | 'failed' {
  const s = (status || '').toLowerCase()
  if (isPaidStatus(s)) return 'paid'
  if (s === 'failed' || s === 'expired' || s === 'refunded') return 'failed'
  return 'pending'
}

/** In-memory paid orders (best-effort on serverless; status also hits NP API) */
const paidOrders = new Map<string, { productId: string; at: number; paymentId: string }>()

export function markPaid(orderId: string, productId: string, paymentId: string): void {
  paidOrders.set(String(orderId), { productId, paymentId, at: Date.now() })
  paidOrders.set(`pay:${paymentId}`, { productId, paymentId, at: Date.now() })
}

export function lookupPaid(id: string): { productId: string; at: number; paymentId: string } | null {
  return paidOrders.get(id) || paidOrders.get(`pay:${id}`) || null
}
