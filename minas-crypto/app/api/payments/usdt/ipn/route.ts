import {
  getIpnSecret,
  isPaidStatus,
  json,
  lookupOrder,
  markOrderPaid,
  rememberOrder,
  resolveProduct,
  verifyNowPaymentsIpn,
} from '../_shared'

/**
 * POST /api/payments/usdt/ipn
 * Verify signature; mark paid only when product+amount match bound order.
 */
export async function POST(request: Request) {
  const secret = getIpnSecret()
  if (!secret) {
    return json({ ok: false, message: 'IPN secret not configured' }, 503)
  }

  const rawBody = await request.text()
  const sig =
    request.headers.get('x-nowpayments-sig') ||
    request.headers.get('X-NOWPayments-Sig') ||
    request.headers.get('x-nowpayments-signature')

  const valid = await verifyNowPaymentsIpn(rawBody, sig, secret)
  if (!valid) {
    return json({ ok: false, message: 'Invalid IPN signature' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return json({ ok: false, message: 'Bad JSON' }, 400)
  }

  const paymentStatus = String(body.payment_status ?? body.status ?? '')
  const paymentId = String(body.payment_id ?? body.id ?? '')
  const orderId = String(body.order_id ?? '')
  const desc = String(body.order_description ?? '')
  const productMatch = /·\s*([a-z_]+)\s*$/i.exec(desc)
  const productId = productMatch?.[1] || ''
  const catalog = productId ? resolveProduct(productId) : null
  const priceAmount =
    typeof body.price_amount === 'number' ? Number(body.price_amount) : catalog?.amountUsdt

  if (!isPaidStatus(paymentStatus)) {
    return json({ ok: true, received: true, paid: false })
  }

  if (!catalog || !orderId.startsWith('cava_') || !paymentId) {
    return json({ ok: false, message: 'IPN missing bound order/product' }, 400)
  }

  let rec = markOrderPaid({
    orderId,
    paymentId,
    productId: catalog.productId,
    amountUsdt: priceAmount,
  })

  if (!rec) {
    // First sight of order on this instance — only if amount matches catalog
    if (typeof priceAmount === 'number' && Math.abs(priceAmount - catalog.amountUsdt) > 0.05) {
      return json({ ok: false, message: 'IPN amount mismatch' }, 400)
    }
    rememberOrder({
      orderId,
      paymentId,
      productId: catalog.productId,
      kind: catalog.kind,
      amountUsdt: catalog.amountUsdt,
      status: 'paid',
      createdAt: Date.now(),
    })
    rec = lookupOrder(orderId)
  }

  return json({
    ok: true,
    received: true,
    paid: Boolean(rec),
    paymentId,
    orderId,
    productId: catalog.productId,
  })
}
