import {
  NP_API,
  getApiKey,
  isPaidStatus,
  issueGrantToken,
  json,
  lookupOrder,
  markOrderPaid,
  normalizeStatus,
  rememberOrder,
  resolveProduct,
  secretsReady,
} from '../_shared'

/**
 * GET /api/payments/usdt/status?id=<payment_id|order_id>
 * NEVER returns paid for demo_* when keys are live.
 * Paid responses include a short-lived grantToken for redeem.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id') || ''
  if (!id) {
    return json({ status: 'failed', paid: false, message: 'Missing id' }, 400)
  }

  // HIGH: demo_* is never paid while NOWPayments keys exist
  if (id.startsWith('demo_')) {
    if (secretsReady()) {
      return json({
        status: 'failed',
        paid: false,
        message: 'demo_ ids rejected while NOWPayments keys are live',
      })
    }
    return json({
      status: 'pending',
      mode: 'demo',
      paid: false,
      message: 'DEMO mode · no server paid shortcut',
    })
  }

  if (!secretsReady()) {
    return json({ status: 'pending', mode: 'demo', paid: false, message: 'No API key' })
  }

  const known = lookupOrder(id)
  if (known?.status === 'paid') {
    const grantToken = await issueGrantToken(known)
    return json({
      status: 'paid',
      paid: true,
      paymentId: known.paymentId,
      orderId: known.orderId,
      productId: known.productId,
      kind: known.kind,
      amountUsdt: known.amountUsdt,
      // null when already redeemed — client must not re-grant
      grantToken: grantToken || undefined,
      grantRedeemed: !grantToken,
      source: 'registry',
    })
  }

  const apiKey = getApiKey()!
  try {
    const npRes = await fetch(`${NP_API}/payment/${encodeURIComponent(id)}`, {
      headers: { 'x-api-key': apiKey },
    })
    if (!npRes.ok) {
      return json({ status: 'pending', paid: false, message: `NP ${npRes.status}` })
    }
    const data = (await npRes.json()) as Record<string, unknown>
    const raw = String(data.payment_status ?? data.status ?? '')
    const status = normalizeStatus(raw)
    const paymentId = String(data.payment_id ?? id)
    const orderId = data.order_id != null ? String(data.order_id) : undefined
    const desc = typeof data.order_description === 'string' ? String(data.order_description) : ''
    const productFromDesc = /·\s*([a-z_]+)\s*$/i.exec(desc)?.[1]
    const productId = productFromDesc || known?.productId
    const catalog = productId ? resolveProduct(productId) : null

    if (status === 'paid' && productId && catalog) {
      const amountHint =
        typeof data.price_amount === 'number' ? Number(data.price_amount) : catalog.amountUsdt
      let rec = markOrderPaid({
        orderId,
        paymentId,
        productId,
        amountUsdt: amountHint,
      })
      // Cold start: only accept cava_ server order ids
      if (!rec && orderId?.startsWith('cava_')) {
        rememberOrder({
          orderId,
          paymentId,
          productId,
          kind: catalog.kind,
          amountUsdt: catalog.amountUsdt,
          status: 'paid',
          createdAt: Date.now(),
        })
        rec = lookupOrder(paymentId) || lookupOrder(orderId)
      }
      if (!rec) {
        return json({
          status: 'pending',
          paid: false,
          message: 'Paid at NP but order binding missing · wait for IPN',
          paymentId,
          orderId,
        })
      }
      const grantToken = await issueGrantToken(rec)
      return json({
        status: 'paid',
        paid: true,
        paymentStatus: raw,
        paymentId: rec.paymentId,
        orderId: rec.orderId,
        productId: rec.productId,
        kind: rec.kind,
        amountUsdt: rec.amountUsdt,
        grantToken: grantToken || undefined,
        grantRedeemed: !grantToken,
        source: 'nowpayments',
      })
    }

    return json({
      status,
      paid: false,
      paymentStatus: raw,
      paymentId,
      orderId,
      productId: productId || undefined,
    })
  } catch {
    return json({ status: 'pending', paid: false, message: 'status fetch failed' })
  }
}
