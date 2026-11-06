import {
  NP_API,
  getApiKey,
  ipnCallbackUrl,
  json,
  resolveProduct,
  secretsReady,
} from './_shared'

type Body = {
  productId?: string
  amountUsdt?: number
  orderId?: string
  payCurrency?: string
  successUrl?: string
  cancelUrl?: string
}

/**
 * POST /api/payments/usdt/create
 * Body: { productId, amountUsdt?, orderId, payCurrency? }
 */
export async function POST(request: Request) {
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

  const productId = String(body.productId || '')
  const product = resolveProduct(productId, body.amountUsdt)
  if (!product) {
    return json(
      { ok: false, mode: 'nowpayments', paymentId: '', message: `Unknown productId: ${productId}` },
      400,
    )
  }

  const orderId = String(body.orderId || `cava_${Date.now().toString(36)}`)
  const payCurrency = body.payCurrency || 'usdttrc20'
  const apiKey = getApiKey()!

  const payload = {
    price_amount: product.amountUsdt,
    price_currency: 'usd',
    pay_currency: payCurrency,
    order_id: orderId,
    order_description: `${product.label} · CAVA · ${product.productId}`,
    ipn_callback_url: ipnCallbackUrl(request),
    is_fixed_rate: true,
    success_url: body.successUrl,
    cancel_url: body.cancelUrl,
  }

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
    return json(
      {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: 'NOWPayments unreachable · UI stays DEMO',
      },
      502,
    )
  }

  const data = (await npRes.json().catch(() => ({}))) as Record<string, unknown>
  if (!npRes.ok) {
    // Never echo API key / full error bodies that might include secrets
    return json(
      {
        ok: false,
        mode: 'nowpayments',
        paymentId: '',
        message: `NOWPayments create failed (${npRes.status})`,
      },
      502,
    )
  }

  const paymentId = String(data.payment_id ?? data.id ?? '')
  const payAddress = data.pay_address != null ? String(data.pay_address) : undefined
  const payAmount = typeof data.pay_amount === 'number' ? data.pay_amount : product.amountUsdt
  const checkoutUrl =
    data.invoice_url != null
      ? String(data.invoice_url)
      : paymentId
        ? `https://nowpayments.io/payment/?iid=${paymentId}`
        : undefined

  return json({
    ok: true,
    mode: 'nowpayments',
    paymentId,
    payAddress,
    payAmount,
    checkoutUrl,
    orderId,
    productId: product.productId,
    kind: product.kind,
    network: 'TRC20',
    message: 'Invoice NOWPayments creada',
  })
}
