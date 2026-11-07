import { json, secretsReady, getApiKey, getIpnSecret } from '../_shared'

/** GET /api/payments/usdt/config */
export async function GET() {
  const ready = secretsReady()
  // Presence flags only — never values
  return json({
    ready,
    mode: ready ? 'nowpayments' : 'demo',
    payCurrency: 'usdttrc20',
    hasApiKey: Boolean(getApiKey()),
    hasIpnSecret: Boolean(getIpnSecret()),
    message: ready
      ? 'NOWPayments keys present · checkout live'
      : 'DEMO · bind NOWPAYMENTS_API_KEY + NOWPAYMENTS_IPN_SECRET',
  })
}
