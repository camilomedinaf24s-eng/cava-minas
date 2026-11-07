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

type NpCreateAttempt = {
  pay_currency: string
  is_fixed_rate: boolean
  status: number
  message: string
  code?: string
}

type PaySuccess = {
  paymentId: string
  payAddress: string
  payAmount: number
  payCurrency: string
  payinExtraId?: string
  via: 'payment' | 'invoice-payment'
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

/** GET /payment/:id — fill missing pay_address */
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
 * Always returns pay_address for in-app copy (no blank NP hosted widget).
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

  const orderId = newServerOrderId()
  const apiKey = getApiKey()!
  const ipn = ipnCallbackUrl(request)
  const wantFixed = (process.env.NOWPAYMENTS_FIXED_RATE || '').toLowerCase() === 'true'

  const pending: OrderRecord = {
    orderId,
    paymentId: '',
    productId: product.productId,
    kind: product.kind,
    amountUsdt: product.amountUsdt,
    status: 'pending',
    createdAt: Date.now(),
  }
  rememberOrder(pending)

  const merchantCoins = await fetchMerchantCoins(apiKey)
  const currencies = pickPayCurrencies(body.payCurrency, merchantCoins)
  const fixedFlags = wantFixed ? [true, false] : [false, true]

  const attempts: NpCreateAttempt[] = []
  let lastData: Record<string, unknown> = {}
  let lastStatus = 0
  let success: PaySuccess | undefined

  // 1) Prefer direct /v1/payment (returns pay_address for white-label / in-app UI)
  for (const payCurrency of currencies) {
    for (const isFixed of fixedFlags) {
      const payload: Record<string, unknown> = {
        price_amount: product.amountUsdt,
        price_currency: 'usd',
        pay_currency: payCurrency,
        order_id: orderId,
        order_description: asciiDesc(product.label, product.productId),
        is_fixed_rate: isFixed,
        is_fee_paid_by_user: false,
      }
      if (/^https:\/\//i.test(ipn)) payload.ipn_callback_url = ipn

      console.info('[np-create]', {
        price_amount: payload.price_amount,
        price_currency: payload.price_currency,
        pay_currency: payload.pay_currency,
        is_fixed_rate: payload.is_fixed_rate,
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
        })
        continue
      }

      const data = (await npRes.json().catch(() => ({}))) as Record<string, unknown>
      lastData = data
      lastStatus = npRes.status

      if (!npRes.ok) {
        const err = parseNpError(data, npRes.status)
        attempts.push({
          pay_currency: payCurrency,
          is_fixed_rate: isFixed,
          status: npRes.status,
          message: err.message,
          code: err.code,
        })
        console.info('[np-create-fail]', {
          status: npRes.status,
          pay_currency: payCurrency,
          is_fixed_rate: isFixed,
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
        })
        continue
      }

      let payAddress = readPayAddress(data)
      let payAmount = readPayAmount(data, product.amountUsdt)
      let payinExtraId =
        data.payin_extra_id != null && String(data.payin_extra_id).length
          ? String(data.payin_extra_id)
          : undefined

      if (!payAddress) {
        const hydrated = await hydratePaymentAddress(apiKey, paymentId, product.amountUsdt)
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
        via: 'payment',
      }
      break
    }
    if (success) break
  }

  // 2) Fallback: invoice → invoice-payment (must yield pay_address; never blank hosted-only)
  if (!success) {
    for (const payCurrency of currencies) {
      const invoicePayload: Record<string, unknown> = {
        price_amount: product.amountUsdt,
        price_currency: 'usd',
        order_id: orderId,
        order_description: asciiDesc(product.label, product.productId),
        is_fixed_rate: false,
        pay_currency: payCurrency,
      }
      if (/^https:\/\//i.test(ipn)) invoicePayload.ipn_callback_url = ipn

      console.info('[np-invoice]', {
        price_amount: invoicePayload.price_amount,
        pay_currency: payCurrency,
        order_id: orderId,
        ipn_host: ipnHostOnly(ipn),
      })

      try {
        const invRes = await fetch(`${NP_API}/invoice`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoicePayload),
        })
        const invData = (await invRes.json().catch(() => ({}))) as Record<string, unknown>
        if (!invRes.ok) {
          const err = parseNpError(invData, invRes.status)
          attempts.push({
            pay_currency: payCurrency,
            is_fixed_rate: false,
            status: invRes.status,
            message: `invoice: ${err.message}`,
            code: err.code,
          })
          continue
        }

        const invoiceId = String(invData.id ?? invData.invoice_id ?? '')
        if (!invoiceId) {
          attempts.push({
            pay_currency: payCurrency,
            is_fixed_rate: false,
            status: invRes.status,
            message: 'invoice sin id',
          })
          continue
        }

        const payFromInv = await fetch(`${NP_API}/invoice-payment`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            iid: Number(invoiceId) || invoiceId,
            pay_currency: payCurrency,
          }),
        })
        const payData = (await payFromInv.json().catch(() => ({}))) as Record<string, unknown>
        if (!payFromInv.ok) {
          attempts.push({
            pay_currency: payCurrency,
            is_fixed_rate: false,
            status: payFromInv.status,
            message: `invoice-payment: ${parseNpError(payData, payFromInv.status).message}`,
          })
          continue
        }

        const paymentId = String(payData.payment_id ?? payData.id ?? '')
        let payAddress = readPayAddress(payData)
        let payAmount = readPayAmount(payData, product.amountUsdt)
        let payinExtraId =
          payData.payin_extra_id != null && String(payData.payin_extra_id).length
            ? String(payData.payin_extra_id)
            : undefined

        if (paymentId && !payAddress) {
          const hydrated = await hydratePaymentAddress(apiKey, paymentId, product.amountUsdt)
          payAddress = hydrated.payAddress || ''
          payAmount = hydrated.payAmount
          if (hydrated.payinExtraId) payinExtraId = hydrated.payinExtraId
        }

        if (!paymentId || !payAddress) {
          attempts.push({
            pay_currency: payCurrency,
            is_fixed_rate: false,
            status: payFromInv.status,
            message: 'invoice-payment sin pay_address',
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
          via: 'invoice-payment',
        }
        break
      } catch {
        attempts.push({
          pay_currency: payCurrency,
          is_fixed_rate: false,
          status: 0,
          message: 'invoice/invoice-payment unreachable',
        })
      }
    }
  }

  if (!success) {
    const last = attempts[attempts.length - 1]
    const detail = last?.message || parseNpError(lastData, lastStatus).message
    const tried = attempts
      .map((a) => `${a.pay_currency}${a.is_fixed_rate ? '+FR' : ''}→${a.status}`)
      .slice(0, 8)
      .join(', ')
    return json(
      {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: `NOWPayments: ${detail}${tried ? ` · tried ${tried}` : ''}`,
        npStatus: last?.status || lastStatus,
        npCode: last?.code,
        debug: {
          price_amount: product.amountUsdt,
          price_currency: 'usd',
          currenciesTried: currencies,
          merchantCoinsCount: merchantCoins.length,
          ipn_host: ipnHostOnly(ipn),
          order_id: orderId,
          requirePayAddress: true,
        },
      },
      502,
    )
  }

  return json({
    ok: true,
    mode: 'nowpayments',
    paymentId: success.paymentId,
    orderId,
    payAddress: success.payAddress,
    payAmount: success.payAmount,
    // No hosted checkout URL — in-app address is the primary UX (avoids blank NP widget)
    checkoutUrl: undefined,
    productId: product.productId,
    kind: product.kind,
    amountUsdt: product.amountUsdt,
    network: networkForPayCurrency(success.payCurrency),
    payCurrency: success.payCurrency,
    payinExtraId: success.payinExtraId,
    via: success.via,
    message: `Envía ${success.payAmount} ${success.payCurrency.toUpperCase()} · ${networkForPayCurrency(success.payCurrency)}`,
  })
}
