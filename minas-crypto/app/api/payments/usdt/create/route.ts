import {
  NP_API,
  attachPaymentId,
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

/**
 * POST /api/payments/usdt/create
 * Body: { productId } — server assigns orderId and binds catalog amount.
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

  const product = resolveProduct(String(body.productId || ''))
  if (!product) {
    return json(
      { ok: false, mode: 'nowpayments', paymentId: '', message: 'Unknown productId' },
      400,
    )
  }

  const orderId = newServerOrderId()
  const payCurrency = body.payCurrency || 'usdttrc20'
  const apiKey = getApiKey()!

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
        message: 'NOWPayments unreachable',
      },
      502,
    )
  }

  const data = (await npRes.json().catch(() => ({}))) as Record<string, unknown>
  if (!npRes.ok) {
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
  if (!paymentId) {
    return json(
      { ok: false, mode: 'nowpayments', paymentId: '', message: 'Create sin payment_id' },
      502,
    )
  }
  attachPaymentId(orderId, paymentId)

  const payAddress = data.pay_address != null ? String(data.pay_address) : undefined
  const payAmount = typeof data.pay_amount === 'number' ? data.pay_amount : product.amountUsdt
  const checkoutUrl =
    data.invoice_url != null
      ? String(data.invoice_url)
      : `https://nowpayments.io/payment/?iid=${paymentId}`

  return json({
    ok: true,
    mode: 'nowpayments',
    paymentId,
    orderId,
    payAddress,
    payAmount,
    checkoutUrl,
    productId: product.productId,
    kind: product.kind,
    amountUsdt: product.amountUsdt,
    network: 'TRC20',
    message: 'Invoice NOWPayments creada',
  })
}
