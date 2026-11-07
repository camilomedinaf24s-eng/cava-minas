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
  /** Ignored for pricing — catalog is source of truth */
  amountUsdt?: number
  /** Ignored — server assigns orderId */
  orderId?: string
  payCurrency?: string
  successUrl?: string
  cancelUrl?: string
}

/** Preferred USDT networks Andres may have enabled (TRC20 → Polygon → BSC → ERC20) */
const USDT_PREFERENCE = ['usdttrc20', 'usdtmatic', 'usdtbsc', 'usdterc20', 'usdt'] as const

type NpCreateAttempt = {
  pay_currency: string
  is_fixed_rate: boolean
  status: number
  message: string
  code?: string
}

function asciiDesc(label: string, productId: string): string {
  // NP can 400 on non-ASCII / emoji in order_description
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

/** Pull readable NP error without leaking secrets */
function parseNpError(data: Record<string, unknown>, status: number): { message: string; code?: string } {
  const raw = String(
    data.message ?? data.error ?? data.code ?? data.statusCode ?? '',
  ).trim()
  const code =
    typeof data.code === 'string'
      ? data.code
      : typeof data.statusCode === 'number'
        ? String(data.statusCode)
        : undefined
  // Redact long hex/token-looking substrings
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
  // Prefer merchant-enabled USDT networks first
  for (const pref of USDT_PREFERENCE) {
    if (merchant.length === 0 || merchant.includes(pref)) push(pref)
  }
  // Any other merchant USDT* tickers
  for (const c of merchant) {
    if (c.includes('usdt')) push(c)
  }
  if (out.length === 0) {
    for (const pref of USDT_PREFERENCE) push(pref)
  }
  return out.slice(0, 6)
}

/**
 * POST /api/payments/usdt/create
 * Body: { productId } — server assigns orderId and binds catalog amount.
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
  // Try floating rate first (fixed_rate often 400 if coin not enabled for FR)
  const fixedFlags = wantFixed ? [true, false] : [false, true]

  const attempts: NpCreateAttempt[] = []
  let lastData: Record<string, unknown> = {}
  let lastStatus = 0
  let success:
    | {
        paymentId: string
        payAddress?: string
        payAmount: number
        checkoutUrl?: string
        payCurrency: string
      }
    | undefined

  for (const payCurrency of currencies) {
    for (const isFixed of fixedFlags) {
      const payload: Record<string, unknown> = {
        // Docs accept number or string — send number (USD catalog)
        price_amount: product.amountUsdt,
        price_currency: 'usd',
        pay_currency: payCurrency,
        order_id: orderId,
        order_description: asciiDesc(product.label, product.productId),
        is_fixed_rate: isFixed,
        is_fee_paid_by_user: false,
      }
      // Only send HTTPS IPN (optional field — omit if not https)
      if (/^https:\/\//i.test(ipn)) {
        payload.ipn_callback_url = ipn
      }

      // Safe server log — no API key
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
      const err = parseNpError(data, npRes.status)

      if (!npRes.ok) {
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
          code: err.code,
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

      attachPaymentId(orderId, paymentId)
      const payAddress = data.pay_address != null ? String(data.pay_address) : undefined
      const payAmount =
        typeof data.pay_amount === 'number' ? data.pay_amount : product.amountUsdt
      const checkoutUrl =
        data.invoice_url != null
          ? String(data.invoice_url)
          : `https://nowpayments.io/payment/?iid=${paymentId}`

      success = {
        paymentId,
        payAddress,
        payAmount,
        checkoutUrl,
        payCurrency,
      }
      break
    }
    if (success) break
  }

  // Fallback: hosted invoice (customer picks coin) if direct payment failed
  if (!success) {
    const invoicePayload: Record<string, unknown> = {
      price_amount: product.amountUsdt,
      price_currency: 'usd',
      order_id: orderId,
      order_description: asciiDesc(product.label, product.productId),
      is_fixed_rate: false,
    }
    if (/^https:\/\//i.test(ipn)) invoicePayload.ipn_callback_url = ipn
    if (body.successUrl) invoicePayload.success_url = body.successUrl
    if (body.cancelUrl) invoicePayload.cancel_url = body.cancelUrl
    // Prefer TRC20 on invoice when possible
    if (currencies[0]) invoicePayload.pay_currency = currencies[0]

    console.info('[np-invoice-fallback]', {
      price_amount: invoicePayload.price_amount,
      pay_currency: invoicePayload.pay_currency,
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
      if (invRes.ok) {
        const invoiceId = String(invData.id ?? invData.invoice_id ?? '')
        const invoiceUrl = invData.invoice_url != null ? String(invData.invoice_url) : ''
        const payCurrency = String(invoicePayload.pay_currency || currencies[0] || 'usdttrc20')

        // Prefer a real payment_id via invoice-payment so status poll works
        if (invoiceId) {
          try {
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
            const paymentId = String(payData.payment_id ?? payData.id ?? '')
            if (payFromInv.ok && paymentId) {
              attachPaymentId(orderId, paymentId)
              return json({
                ok: true,
                mode: 'nowpayments',
                paymentId,
                orderId,
                payAddress:
                  payData.pay_address != null ? String(payData.pay_address) : undefined,
                payAmount:
                  typeof payData.pay_amount === 'number'
                    ? payData.pay_amount
                    : product.amountUsdt,
                checkoutUrl:
                  invoiceUrl ||
                  (payData.invoice_url != null
                    ? String(payData.invoice_url)
                    : `https://nowpayments.io/payment/?iid=${paymentId}`),
                productId: product.productId,
                kind: product.kind,
                amountUsdt: product.amountUsdt,
                network: networkForPayCurrency(payCurrency),
                payCurrency,
                via: 'invoice-payment',
                message: `Invoice+payment NOWPayments · ${payCurrency}`,
              })
            }
            attempts.push({
              pay_currency: payCurrency,
              is_fixed_rate: false,
              status: payFromInv.status,
              message: `invoice-payment: ${parseNpError(payData, payFromInv.status).message}`,
            })
          } catch {
            attempts.push({
              pay_currency: payCurrency,
              is_fixed_rate: false,
              status: 0,
              message: 'invoice-payment unreachable',
            })
          }
        }

        if (invoiceUrl) {
          const paymentId = invoiceId ? `invoice_${invoiceId}` : `invoice_${orderId}`
          attachPaymentId(orderId, paymentId)
          return json({
            ok: true,
            mode: 'nowpayments',
            paymentId,
            orderId,
            payAddress: undefined,
            payAmount: product.amountUsdt,
            checkoutUrl: invoiceUrl,
            productId: product.productId,
            kind: product.kind,
            amountUsdt: product.amountUsdt,
            network: networkForPayCurrency(payCurrency),
            payCurrency,
            via: 'invoice',
            message: 'Invoice NOWPayments (checkout) creada · abre el link para pagar',
          })
        }
      } else {
        const err = parseNpError(invData, invRes.status)
        attempts.push({
          pay_currency: String(invoicePayload.pay_currency || 'invoice'),
          is_fixed_rate: false,
          status: invRes.status,
          message: `invoice: ${err.message}`,
          code: err.code,
        })
      }
    } catch {
      attempts.push({
        pay_currency: 'invoice',
        is_fixed_rate: false,
        status: 0,
        message: 'invoice unreachable',
      })
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
        // Safe debug for UI / Andres — no secrets
        debug: {
          price_amount: product.amountUsdt,
          price_currency: 'usd',
          currenciesTried: currencies,
          merchantCoinsCount: merchantCoins.length,
          ipn_host: ipnHostOnly(ipn),
          order_id: orderId,
          fixedRateEnv: wantFixed,
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
    checkoutUrl: success.checkoutUrl,
    productId: product.productId,
    kind: product.kind,
    amountUsdt: product.amountUsdt,
    network: networkForPayCurrency(success.payCurrency),
    payCurrency: success.payCurrency,
    via: 'payment',
    message: `Invoice NOWPayments creada · ${success.payCurrency}`,
  })
}
