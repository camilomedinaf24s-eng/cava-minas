import { operatorAllowlist, resolveOperator } from '../_shared'

/**
 * GET /api/me/operator — status only (does not unlock gifts).
 * Claim requires POST /api/me/operator/claim.
 */
export async function GET(request: Request) {
  const decision = await resolveOperator(request)
  const allow = operatorAllowlist()

  if (!decision.operator) {
    return Response.json(
      {
        operator: false,
        reason: decision.reason,
        email: decision.email,
        allowlistConfigured: allow.length > 0,
        whoCanClaim: 'Andres Medina · camilo.medinaf24s@gmail.com (Cursor identity)',
        message: decision.message,
        claimPath: '/api/me/operator/claim',
      },
      { headers: { 'cache-control': 'private, no-store' } },
    )
  }

  return Response.json(
    {
      operator: true,
      email: decision.email,
      name: decision.identity.name || undefined,
      sub: decision.identity.sub,
      allowlistConfigured: true,
      whoCanClaim: 'Andres Medina · camilo.medinaf24s@gmail.com (Cursor identity)',
      message: 'Operador autorizado · usa POST /api/me/operator/claim para desbloquear',
      claimPath: '/api/me/operator/claim',
    },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
