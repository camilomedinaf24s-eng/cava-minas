/**
 * Shared NOWPayments helpers — server only (publish-app / Next route handlers).
 * Orders bind productId+amount; paid grants are HMAC-signed tokens.
 */

export const NP_API = 'https://api.nowpayments.io/v1'

export type CatalogProduct = {
  productId: string
  kind: 'energy' | 'box'
  amountUsdt: number
  label: string
}

/**
 * Shop floors ≥ NOWPayments USDT network mins (~$9 floating TRC20).
 * Create still queries /min-amount and may bump further at checkout.
 */
export const PRODUCT_CATALOG: Record<string, CatalogProduct> = {
  basic: { productId: 'basic', kind: 'energy', amountUsdt: 9.99, label: '⚡ Pack Básico' },
  medium: { productId: 'medium', kind: 'energy', amountUsdt: 14.99, label: '⚡ Pack Medio' },
  large: { productId: 'large', kind: 'energy', amountUsdt: 19.99, label: '⚡ Pack Grande' },
  common: { productId: 'common', kind: 'box', amountUsdt: 9.99, label: 'Caja común' },
  rare: { productId: 'rare', kind: 'box', amountUsdt: 14.99, label: 'Caja rara' },
  legendary: { productId: 'legendary', kind: 'box', amountUsdt: 24.99, label: 'Caja legendaria' },
}

export type OrderRecord = {
  orderId: string
  paymentId: string
  productId: string
  kind: 'energy' | 'box'
  amountUsdt: number
  status: 'pending' | 'paid' | 'failed'
  createdAt: number
  grantIssued?: boolean
  /** True after first successful redeem — blocks re-issue + reuse */
  grantRedeemed?: boolean
}

/** In-memory order registry (best-effort on serverless; grant token is the durable proof) */
const ordersById = new Map<string, OrderRecord>()
const ordersByPayment = new Map<string, OrderRecord>()
/** Exact token strings already redeemed */
const redeemedGrants = new Set<string>()
/** orderId / paymentId already redeemed — blocks multi-redeem via re-issued tokens */
const redeemedOrderKeys = new Set<string>()

/** create rate-limit: sliding window per IP */
const CREATE_WINDOW_MS = 60_000
const CREATE_MAX_PER_WINDOW = 8
const createHitsByKey = new Map<string, number[]>()

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const v = (typeof process !== 'undefined' ? process.env?.[name] : undefined) as string | undefined
    if (v && String(v).trim().length > 0) return String(v).trim()
  }
  return undefined
}

export function getApiKey(): string | undefined {
  const k = readEnv('NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_KEY')
  return k && k.length > 8 ? k : undefined
}

export function getIpnSecret(): string | undefined {
  const k = readEnv('NOWPAYMENTS_IPN_SECRET', 'NOWPAYMENTS_IPN')
  return k && k.length > 4 ? k : undefined
}

/** Prefer IPN secret for HMAC grants; fall back to API key */
export function getSigningSecret(): string | undefined {
  return getIpnSecret() || getApiKey()
}

export function secretsReady(): boolean {
  return Boolean(getApiKey())
}

export function resolveProduct(productId: string): CatalogProduct | null {
  return PRODUCT_CATALOG[productId] ?? null
}

export function newServerOrderId(): string {
  const rand = crypto.getRandomValues(new Uint8Array(8))
  const hex = [...rand].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `cava_${Date.now().toString(36)}_${hex}`
}

export function ipnCallbackUrl(request: Request): string {
  const fromEnv = readEnv('NOWPAYMENTS_IPN_URL')
  if (fromEnv && /^https:\/\//i.test(fromEnv)) return fromEnv.replace(/\/$/, '')
  const origin = new URL(request.url).origin
  return `${origin}/api/payments/usdt/ipn`
}

export function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) out[key] = sortObject(obj[key])
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

export async function hmacSha256B64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
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
  if (expected.length !== signatureHeader.length) return false
  let ok = 0
  for (let i = 0; i < expected.length; i++) ok |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
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

export function rememberOrder(rec: OrderRecord): void {
  ordersById.set(rec.orderId, rec)
  if (rec.paymentId) ordersByPayment.set(rec.paymentId, rec)
}

export function lookupOrder(id: string): OrderRecord | null {
  return ordersById.get(id) || ordersByPayment.get(id) || null
}

export function attachPaymentId(orderId: string, paymentId: string): OrderRecord | null {
  const rec = ordersById.get(orderId)
  if (!rec) return null
  rec.paymentId = paymentId
  ordersByPayment.set(paymentId, rec)
  return rec
}

/** Mark paid only if productId (+ optional amount) match the stored order */
export function markOrderPaid(opts: {
  orderId?: string
  paymentId?: string
  productId: string
  amountUsdt?: number
}): OrderRecord | null {
  const rec =
    (opts.orderId ? ordersById.get(opts.orderId) : null) ||
    (opts.paymentId ? ordersByPayment.get(opts.paymentId) : null)
  if (!rec) return null
  if (rec.productId !== opts.productId) return null
  if (typeof opts.amountUsdt === 'number' && Math.abs(opts.amountUsdt - rec.amountUsdt) > 0.05) {
    return null
  }
  rec.status = 'paid'
  if (opts.paymentId && !rec.paymentId) {
    rec.paymentId = opts.paymentId
    ordersByPayment.set(opts.paymentId, rec)
  }
  return rec
}

export type GrantPayload = {
  v: 1
  orderId: string
  paymentId: string
  productId: string
  kind: 'energy' | 'box'
  amountUsdt: number
  exp: number
}

function b64urlJson(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64urlJson<T>(s: string): T | null {
  try {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
    const raw = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function isGrantRedeemed(rec: OrderRecord): boolean {
  if (rec.grantRedeemed) return true
  if (redeemedOrderKeys.has(rec.orderId)) return true
  if (rec.paymentId && redeemedOrderKeys.has(rec.paymentId)) return true
  return false
}

/** Issue grant only once per paid order; null if already redeemed */
export async function issueGrantToken(rec: OrderRecord): Promise<string | null> {
  const secret = getSigningSecret()
  if (!secret || rec.status !== 'paid' || !rec.paymentId) return null
  if (isGrantRedeemed(rec)) return null
  const payload: GrantPayload = {
    v: 1,
    orderId: rec.orderId,
    paymentId: rec.paymentId,
    productId: rec.productId,
    kind: rec.kind,
    amountUsdt: rec.amountUsdt,
    exp: Date.now() + 1000 * 60 * 60 * 6,
  }
  const body = b64urlJson(payload)
  const sig = await hmacSha256B64Url(secret, body)
  rec.grantIssued = true
  return `${body}.${sig}`
}

function markGrantRedeemed(payload: GrantPayload, token: string): void {
  redeemedGrants.add(token)
  redeemedOrderKeys.add(payload.orderId)
  if (payload.paymentId) redeemedOrderKeys.add(payload.paymentId)
  const rec = lookupOrder(payload.orderId) || lookupOrder(payload.paymentId)
  if (rec) {
    rec.grantRedeemed = true
    rememberOrder(rec)
  }
}

/**
 * Verify HMAC grant and consume once.
 * Rejects: bad sig, expired, unknown product, already-redeemed token OR orderId/paymentId.
 */
export async function verifyAndConsumeGrant(
  token: string,
): Promise<{ ok: true; payload: GrantPayload } | { ok: false; message: string }> {
  const secret = getSigningSecret()
  if (!secret) return { ok: false, message: 'No signing secret' }
  const [body, sig] = token.split('.')
  if (!body || !sig) return { ok: false, message: 'Malformed grant' }
  const expected = await hmacSha256B64Url(secret, body)
  if (expected.length !== sig.length) return { ok: false, message: 'Bad grant sig' }
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return { ok: false, message: 'Bad grant sig' }
  const payload = fromB64urlJson<GrantPayload>(body)
  if (!payload || payload.v !== 1) return { ok: false, message: 'Bad grant payload' }
  if (payload.exp < Date.now()) return { ok: false, message: 'Grant expired' }
  if (!PRODUCT_CATALOG[payload.productId]) return { ok: false, message: 'Unknown product' }
  if (Math.abs(PRODUCT_CATALOG[payload.productId].amountUsdt - payload.amountUsdt) > 0.02) {
    return { ok: false, message: 'Amount mismatch' }
  }
  if (redeemedGrants.has(token)) return { ok: false, message: 'Grant already redeemed' }
  if (redeemedOrderKeys.has(payload.orderId) || redeemedOrderKeys.has(payload.paymentId)) {
    return { ok: false, message: 'Grant already redeemed' }
  }
  const rec = lookupOrder(payload.orderId) || lookupOrder(payload.paymentId)
  if (rec) {
    if (rec.productId !== payload.productId) return { ok: false, message: 'Order product mismatch' }
    if (rec.status !== 'paid') return { ok: false, message: 'Order not paid' }
    if (rec.grantRedeemed) return { ok: false, message: 'Grant already redeemed' }
  }
  markGrantRedeemed(payload, token)
  return { ok: true, payload }
}

export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  const cf = request.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  return 'unknown'
}

/** Sliding-window rate limit for POST /create. Returns null if allowed, else retry-after seconds. */
export function checkCreateRateLimit(request: Request): { limited: false } | { limited: true; retryAfterSec: number } {
  const key = `ip:${clientIp(request)}`
  const now = Date.now()
  const prev = (createHitsByKey.get(key) || []).filter((t) => now - t < CREATE_WINDOW_MS)
  if (prev.length >= CREATE_MAX_PER_WINDOW) {
    const oldest = prev[0] ?? now
    const retryAfterSec = Math.max(1, Math.ceil((CREATE_WINDOW_MS - (now - oldest)) / 1000))
    createHitsByKey.set(key, prev)
    return { limited: true, retryAfterSec }
  }
  prev.push(now)
  createHitsByKey.set(key, prev)
  return { limited: false }
}
