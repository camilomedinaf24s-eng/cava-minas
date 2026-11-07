import { json, verifyAndConsumeGrant } from '../_shared'

type Body = { grantToken?: string }

/**
 * POST /api/payments/usdt/redeem
 * Body: { grantToken } — verifies HMAC grant; one-time redeem.
 */
export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return json({ ok: false, message: 'Invalid JSON' }, 400)
  }
  const token = String(body.grantToken || '')
  if (!token) return json({ ok: false, message: 'Missing grantToken' }, 400)

  const result = await verifyAndConsumeGrant(token)
  if (!result.ok) {
    return json({ ok: false, message: result.message }, 403)
  }
  const { payload } = result
  return json({
    ok: true,
    productId: payload.productId,
    kind: payload.kind,
    amountUsdt: payload.amountUsdt,
    orderId: payload.orderId,
    paymentId: payload.paymentId,
  })
}
