import {
  NP_API,
  attachPaymentId,
  checkCreateRateLimit,
  getApiKey,
  ipnCallbackUrl,
  json,
  newServerOrderId,
  rememberOrder,
  resolveProduct,
  secretsReady,
  type OrderRecord,
} from '../_shared'

type Body = {
  productId?: string
  amountUsdt?: number
  orderId?: string
  payCurrency?: string
  successUrl?: string
  cancelUrl?: string
}

/** Preferred USDT networks (TRC20 → Polygon → BSC → ERC20) */
const USDT_PREFERENCE = ['usdttrc20', 'usdtmatic', 'usdtbsc', 'usdterc20', 'usdt'] as const

/** Safety floor when min-amount API unavailable (USDT networks ~$9) */
const FALLBACK_MIN_USD = 9.5

type NpCreateAttempt = {
  pay_currency: string
  is_fixed_rate: boolean
  status: number
  message: string
  code?: string
  price_usd?: number
}

type PaySuccess = {
  paymentId: string
  payAddress: string
  payAmount: number
  payCurrency: string
  payinExtraId?: string
  priceUsd: number
  catalogUsd: number
  bumped: boolean
  minFiatUsd?: number
}

function asciiDesc(label: string, productId: string): string {
  const clean = label.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim()
  return `${clean || 'CAVA item'} · CAVA · ${productId}`.slice(0, 180)
}

function networkForPayCurrency(c: string): 'TRC20' | 'Polygon' | 'BEP20' | 'ERC20' | 'USDT' {
  const x = c.toLowerCase()
  if (x.includes('trc20') || x === 'usdttrc20') return 'TRC20'
  if (x.includes('matic') || x.includes('polygon')) return 'Polygon'
  if (x.includes('bsc') || x.includes('bep')) return 'BEP20'
  if (x.includes('erc20')) return 'ERC20'
  return 'USDT'
}

function parseNpError(data: Record<string, unknown>, status: number): { message: string; code?: string } {
  const raw = String(data.message ?? data.error ?? data.code ?? data.statusCode ?? '').trim()
  const code =
    typeof data.code === 'string'
      ? data.code
      : typeof data.statusCode === 'number'
        ? String(data.statusCode)
        : undefined
  const cleaned = raw
    .replace(/[A-Za-z0-9_-]{28,}/g, '[…]')
    .replace(/\s+/g, ' ')
    .slice(0, 220)
  return {
    message: cleaned || `NOWPayments create failed (${status})`,
    code,
  }
}

function ipnHostOnly(ipn: string): string {
  try {
    return new URL(ipn).host
  } catch {
    return 'invalid-ipn'
  }
}

function readPayAddress(data: Record<string, unknown>): string {
  return String(data.pay_address ?? data.payAddress ?? data.address ?? '').trim()
}

function readPayAmount(data: Record<string, unknown>, fallback: number): number {
  if (typeof data.pay_amount === 'number') return data.pay_amount
  if (typeof data.pay_amount === 'string' && data.pay_amount.trim()) {
    const n = Number(data.pay_amount)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function roundUsd(n: number): number {
  return Math.ceil(n * 100) / 100
}

async function fetchMerchantCoins(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`${NP_API}/merchant/coins`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as {
      selectedCurrencies?: string[]
      currencies?: string[]
    }
    const list = data.selectedCurrencies || data.currencies || []
    return list.map((c) => String(c).toLowerCase())
  } catch {
    return []
  }
}

function pickPayCurrencies(requested: string | undefined, merchant: string[]): string[] {
  const req = (requested || '').toLowerCase().trim()
  const out: string[] = []
  const push = (c: string) => {
    const x = c.toLowerCase()
    if (x && !out.includes(x)) out.push(x)
  }
  if (req) push(req)
  for (const pref of USDT_PREFERENCE) {
    if (merchant.length === 0 || merchant.includes(pref)) push(pref)
  }
  for (const c of merchant) {
    if (c.includes('usdt')) push(c)
  }
  if (out.length === 0) {
    for (const pref of USDT_PREFERENCE) push(pref)
  }
  return out.slice(0, 6)
}

/**
 * GET /min-amount?currency_from=usd&currency_to=usdttrc20&fiat_equivalent=usd
 * Returns fiat floor in USD for that pay network.
 */
async function fetchMinFiatUsd(
  apiKey: string,
  payCurrency: string,
  isFixed: boolean,
): Promise<{ minCrypto?: number; minFiatUsd: number; source: string }> {
  try {
    const qs = new URLSearchParams({
      currency_from: 'usd',
      currency_to: payCurrency,
      fiat_equivalent: 'usd',
      is_fixed_rate: isFixed ? 'true' : 'false',
    })
    const res = await fetch(`${NP_API}/min-amount?${qs}`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
    })
    if (!res.ok) {
      return { minFiatUsd: FALLBACK_MIN_USD, source: `fallback:${res.status}` }
    }
    const data = (await res.json()) as {
      min_amount?: number | string
      fiat_equivalent?: number | string
    }
    const minCrypto =
      typeof data.min_amount === 'number'
        ? data.min_amount
        : data.min_amount
          ? Number(data.min_amount)
          : undefined
    let minFiat =
      typeof data.fiat_equivalent === 'number'
        ? data.fiat_equivalent
        : data.fiat_equivalent
          ? Number(data.fiat_equivalent)
          : undefined
    // For USDT* pairs, min_amount is already ~USD 1:1 when fiat missing
    if ((!minFiat || !Number.isFinite(minFiat)) && minCrypto && Number.isFinite(minCrypto)) {
      minFiat = minCrypto
    }
    if (!minFiat || !Number.isFinite(minFiat) || minFiat <= 0) {
      return { minCrypto, minFiatUsd: FALLBACK_MIN_USD, source: 'fallback:parse' }
    }
    return { minCrypto, minFiatUsd: minFiat, source: 'min-amount' }
  } catch {
    return { minFiatUsd: FALLBACK_MIN_USD, source: 'fallback:error' }
  }
}

/** Charge at least NP min (+2% buffer) so FX never drops crypto below min */
function effectivePriceUsd(catalogUsd: number, minFiatUsd: number): { priceUsd: number; bumped: boolean } {
  const floor = roundUsd(minFiatUsd * 1.02)
  if (catalogUsd + 0.001 >= floor) return { priceUsd: roundUsd(catalogUsd), bumped: false }
  return { priceUsd: floor, bumped: true }
}

async function hydratePaymentAddress(
  apiKey: string,
  paymentId: string,
  fallbackAmount: number,
): Promise<{ payAddress?: string; payAmount: number; payCurrency?: string; payinExtraId?: string }> {
  try {
    const res = await fetch(`${NP_API}/payment/${encodeURIComponent(paymentId)}`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
    })
    if (!res.ok) return { payAmount: fallbackAmount }
    const data = (await res.json()) as Record<string, unknown>
    return {
      payAddress: readPayAddress(data) || undefined,
      payAmount: readPayAmount(data, fallbackAmount),
      payCurrency: data.pay_currency != null ? String(data.pay_currency) : undefined,
      payinExtraId:
        data.payin_extra_id != null && String(data.payin_extra_id).length
          ? String(data.payin_extra_id)
          : undefined,
    }
  } catch {
    return { payAmount: fallbackAmount }
  }
}

/**
 * POST /api/payments/usdt/create
 * Always USD price_currency + pay_currency; bump to NP min; prefer /v1/payment with pay_address.
 */
export async function POST(request: Request) {
  const rl = checkCreateRateLimit(request)
  if (rl.limited) {
    return new Response(
      JSON.stringify({
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: `Rate limited · retry in ${rl.retryAfterSec}s`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Retry-After': String(rl.retryAfterSec),
        },
      },
    )
  }

  if (!secretsReady()) {
    return json(
      {
        ok: false,
        mode: 'demo',
        paymentId: '',
        message: 'DEMO · NOWPAYMENTS_API_KEY missing on server',
      },
      503,
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return json({ ok: false, mode: 'nowpayments', paymentId: '', message: 'Invalid JSON' }, 400)
  }

  const product = resolveProduct(String(body.productId || ''))
  if (!product) {
    return json(
      { ok: false, mode: 'nowpayments', paymentId: '', message: 'Unknown productId' },
      400,
    )
  }

  const catalogUsd = product.amountUsdt
  const orderId = newServerOrderId()
  const apiKey = getApiKey()!
  const ipn = ipnCallbackUrl(request)
  // Fixed rate raises mins (~$20 USDT) — keep floating unless explicitly enabled
  const wantFixed = (process.env.NOWPAYMENTS_FIXED_RATE || '').toLowerCase() === 'true'
  const fixedFlags = wantFixed ? [true, false] : [false]

  const merchantCoins = await fetchMerchantCoins(apiKey)
  const currencies = pickPayCurrencies(body.payCurrency, merchantCoins)

  const attempts: NpCreateAttempt[] = []
  let success: PaySuccess | undefined

  // Prefer /v1/payment only (no invoice-payment — that path produced crypto-below-min errors)
  for (const payCurrency of currencies) {
    for (const isFixed of fixedFlags) {
      const minInfo = await fetchMinFiatUsd(apiKey, payCurrency, isFixed)
      const { priceUsd, bumped } = effectivePriceUsd(catalogUsd, minInfo.minFiatUsd)

      // Bind order to the charged USD amount (for IPN/status match)
      const pending: OrderRecord = {
        orderId,
        paymentId: '',
        productId: product.productId,
        kind: product.kind,
        amountUsdt: priceUsd,
        status: 'pending',
        createdAt: Date.now(),
      }
      rememberOrder(pending)

      // CRITICAL: price in USD — never send pay_amount (lets NP convert; avoids FX-under-min)
      const payload: Record<string, unknown> = {
        price_amount: priceUsd,
        price_currency: 'usd',
        pay_currency: payCurrency,
        order_id: orderId,
        order_description: asciiDesc(product.label, product.productId),
        is_fixed_rate: isFixed,
        is_fee_paid_by_user: false,
      }
      if (/^https:\/\//i.test(ipn)) payload.ipn_callback_url = ipn

      console.info('[np-create]', {
        price_amount: priceUsd,
        price_currency: 'usd',
        pay_currency: payCurrency,
        is_fixed_rate: isFixed,
        catalog_usd: catalogUsd,
        min_fiat_usd: minInfo.minFiatUsd,
        min_source: minInfo.source,
        bumped,
        order_id: orderId,
        ipn_host: ipnHostOnly(ipn),
        productId: product.productId,
      })

      let npRes: Response
      try {
        npRes = await fetch(`${NP_API}/payment`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      } catch {
        attempts.push({
          pay_currency: payCurrency,
          is_fixed_rate: isFixed,
          status: 0,
          message: 'NOWPayments unreachable',
          price_usd: priceUsd,
        })
        continue
      }

      const data = (await npRes.json().catch(() => ({}))) as Record<string, unknown>

      if (!npRes.ok) {
        const err = parseNpError(data, npRes.status)
        attempts.push({
          pay_currency: payCurrency,
          is_fixed_rate: isFixed,
          status: npRes.status,
          message: err.message,
          code: err.code,
          price_usd: priceUsd,
        })
        console.info('[np-create-fail]', {
          status: npRes.status,
          pay_currency: payCurrency,
          price_usd: priceUsd,
          message: err.message,
        })
        continue
      }

      const paymentId = String(data.payment_id ?? data.id ?? '')
      if (!paymentId) {
        attempts.push({
          pay_currency: payCurrency,
          is_fixed_rate: isFixed,
          status: npRes.status,
          message: 'Create sin payment_id',
          price_usd: priceUsd,
        })
        continue
      }

      let payAddress = readPayAddress(data)
      let payAmount = readPayAmount(data, priceUsd)
      let payinExtraId =
        data.payin_extra_id != null && String(data.payin_extra_id).length
          ? String(data.payin_extra_id)
          : undefined

      if (!payAddress) {
        const hydrated = await hydratePaymentAddress(apiKey, paymentId, priceUsd)
        payAddress = hydrated.payAddress || ''
        payAmount = hydrated.payAmount
        if (hydrated.payinExtraId) payinExtraId = hydrated.payinExtraId
      }

      if (!payAddress) {
        attempts.push({
          pay_currency: payCurrency,
          is_fixed_rate: isFixed,
          status: npRes.status,
          message: 'payment sin pay_address',
          price_usd: priceUsd,
        })
        continue
      }

      attachPaymentId(orderId, paymentId)
      success = {
        paymentId,
        payAddress,
        payAmount,
        payCurrency,
        payinExtraId,
        priceUsd,
        catalogUsd,
        bumped,
        minFiatUsd: minInfo.minFiatUsd,
      }
      break
    }
    if (success) break
  }

  if (!success) {
    const last = attempts[attempts.length - 1]
    const belowMin = /less than minimal|min(imum)?/i.test(last?.message || '')
    const tried = attempts
      .map((a) => `${a.pay_currency}@$${a.price_usd ?? '?'}${a.is_fixed_rate ? '+FR' : ''}→${a.status}`)
      .slice(0, 8)
      .join(', ')
    const hint = belowMin
      ? ` · precio catálogo $${catalogUsd} bajo mínimo NP (~$${FALLBACK_MIN_USD}+ USDT)`
      : ''
    return json(
      {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: `NOWPayments: ${last?.message || 'create failed'}${hint}${tried ? ` · tried ${tried}` : ''}`,
        npStatus: last?.status,
        npCode: last?.code,
        belowMin: belowMin || undefined,
        debug: {
          price_currency: 'usd',
          catalog_usd: catalogUsd,
          currenciesTried: currencies,
          merchantCoinsCount: merchantCoins.length,
          ipn_host: ipnHostOnly(ipn),
          order_id: orderId,
          via: 'payment-only',
        },
      },
      502,
    )
  }

  const net = networkForPayCurrency(success.payCurrency)
  const bumpNote = success.bumped
    ? ` · ajustado a mín. NP $${success.priceUsd} (catálogo $${success.catalogUsd})`
    : ''

  return json({
    ok: true,
    mode: 'nowpayments',
    paymentId: success.paymentId,
    orderId,
    payAddress: success.payAddress,
    payAmount: success.payAmount,
    checkoutUrl: undefined,
    productId: product.productId,
    kind: product.kind,
    amountUsdt: success.priceUsd,
    catalogUsd: success.catalogUsd,
    priceBumped: success.bumped,
    minFiatUsd: success.minFiatUsd,
    network: net,
    payCurrency: success.payCurrency,
    payinExtraId: success.payinExtraId,
    via: 'payment',
    message: `Envía ${success.payAmount} ${success.payCurrency.toUpperCase()} · ${net}${bumpNote}`,
  })
}
