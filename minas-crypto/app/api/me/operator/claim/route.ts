import {
  OPERATOR_GIFT_META,
  consumeOperatorClaimToken,
  hasClaimedSub,
  issueOperatorClaimToken,
  resolveOperator,
} from '../../_shared'

/**
 * POST /api/me/operator/claim
 * Body optional: { claimToken?: string }
 * - Without claimToken: issue one-time claimToken for allowlisted operator (server gate).
 * - With claimToken: consume it (single-use) → client may then apply local gifts.
 *
 * Client alone cannot unlock: applyOperatorGifts must follow a successful consume.
 */
export async function POST(request: Request) {
  const decision = await resolveOperator(request)
  if (!decision.operator) {
    return Response.json(
      {
        ok: false,
        operator: false,
        reason: decision.reason,
        message: decision.message,
      },
      { status: 403, headers: { 'cache-control': 'private, no-store' } },
    )
  }

  let body: { claimToken?: string } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text) as { claimToken?: string }
  } catch {
    return Response.json(
      { ok: false, message: 'Invalid JSON' },
      { status: 400, headers: { 'cache-control': 'private, no-store' } },
    )
  }

  const incoming = String(body.claimToken || '')
  if (incoming) {
    const consumed = await consumeOperatorClaimToken(incoming)
    if (!consumed.ok) {
      return Response.json(
        { ok: false, message: consumed.message },
        { status: 403, headers: { 'cache-control': 'private, no-store' } },
      )
    }
    if (consumed.payload.sub !== decision.identity.sub) {
      return Response.json(
        { ok: false, message: 'Claim token subject mismatch' },
        { status: 403, headers: { 'cache-control': 'private, no-store' } },
      )
    }
    return Response.json(
      {
        ok: true,
        consumed: true,
        email: decision.email,
        sub: decision.identity.sub,
        gifts: OPERATOR_GIFT_META,
        message: 'Claim autorizado · aplicar regalos en cliente',
      },
      { headers: { 'cache-control': 'private, no-store' } },
    )
  }

  // Issue phase
  const { claimToken, exp } = await issueOperatorClaimToken(decision.identity.sub, decision.email)
  return Response.json(
    {
      ok: true,
      issued: true,
      claimToken,
      exp,
      alreadyClaimedServer: hasClaimedSub(decision.identity.sub),
      email: decision.email,
      sub: decision.identity.sub,
      gifts: OPERATOR_GIFT_META,
      message: 'Claim token emitido · POST de nuevo con claimToken para consumir',
    },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
