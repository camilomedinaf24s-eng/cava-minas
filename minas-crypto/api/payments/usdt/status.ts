import {
  NP_API,
  getApiKey,
  isPaidStatus,
  json,
  lookupPaid,
  normalizeStatus,
  secretsReady,
} from './_shared'

/**
 * GET /api/payments/usdt/status?id=<payment_id|order_id>
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id') || ''
  if (!id) {
    return json({ status: 'failed', message: 'Missing id' }, 400)
  }

  // Fast path: IPN already marked paid
  const cached = lookupPaid(id)
  if (cached) {
    return json({
      status: 'paid',
      paymentId: cached.paymentId,
      productId: cached.productId,
      source: 'ipn',
    })
  }

  if (!secretsReady()) {
    return json({ status: 'pending', mode: 'demo', message: 'No API key' })
  }

  if (id.startsWith('demo_')) {
    return json({ status: 'paid', mode: 'demo' })
  }

  const apiKey = getApiKey()!
  try {
    const npRes = await fetch(`${NP_API}/payment/${encodeURIComponent(id)}`, {
      headers: { 'x-api-key': apiKey },
    })
    if (!npRes.ok) {
      return json({ status: 'pending', message: `NP ${npRes.status}` })
    }
    const data = (await npRes.json()) as Record<string, unknown>
    const raw = String(data.payment_status ?? data.status ?? '')
    const status = normalizeStatus(raw)
    return json({
      status,
      paymentStatus: raw,
      paymentId: String(data.payment_id ?? id),
      orderId: data.order_id != null ? String(data.order_id) : undefined,
      productId:
        typeof data.order_description === 'string'
          ? extractProductId(String(data.order_description))
          : undefined,
      paid: isPaidStatus(raw),
    })
  } catch {
    return json({ status: 'pending', message: 'status fetch failed' })
  }
}

function extractProductId(desc: string): string | undefined {
  // "... · CAVA · basic"
  const m = /·\s*([a-z_]+)\s*$/i.exec(desc)
  return m?.[1]
}
