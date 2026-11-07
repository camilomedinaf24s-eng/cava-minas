import {
  getIpnSecret,
  isPaidStatus,
  json,
  markPaid,
  verifyNowPaymentsIpn,
} from '../_shared'

/**
 * POST /api/payments/usdt/ipn
 * NOWPayments IPN callback — verify x-nowpayments-sig (HMAC-SHA512).
 * Grant path: mark paid; client polls status then delivers ítem locally.
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
  const productId = productMatch?.[1] || String(body.order_description || '')

  if (isPaidStatus(paymentStatus)) {
    if (orderId) markPaid(orderId, productId, paymentId)
    if (paymentId) markPaid(paymentId, productId, paymentId)
  }

  // Never log secrets or full payment payloads
  return json({
    ok: true,
    received: true,
    paid: isPaidStatus(paymentStatus),
    paymentId: paymentId || undefined,
  })
}
