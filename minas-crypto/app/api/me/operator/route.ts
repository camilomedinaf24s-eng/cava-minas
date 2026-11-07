import { getIdentity } from '../../../../cursor/identity'

/**
 * Who may claim operator gifts — Andres Medina only (Cursor viewer email).
 *
 * Allowlist:
 * 1. OPERATOR_EMAILS / OPERATOR_EMAIL env (comma-separated) on the host
 * 2. Built-in default: camilo.medinaf24s@gmail.com (Andres Medina · Cursor owner)
 *
 * Every other signed-in visitor → operator:false. No auto-operator from PLAYER brand.
 * Locally: identity.dev.ts simulated viewer must use an allowlisted email, or set
 * OPERATOR_EMAILS=dev@example.com for local gift testing.
 */
const DEFAULT_OPERATOR_EMAILS = ['camilo.medinaf24s@gmail.com']

function operatorAllowlist(): string[] {
  const raw = (process.env.OPERATOR_EMAILS || process.env.OPERATOR_EMAIL || '').trim()
  const fromEnv = raw
    ? raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : []
  return [...new Set([...DEFAULT_OPERATOR_EMAILS, ...fromEnv])]
}

export async function GET(request: Request) {
  const identity = await getIdentity(request)
  const allow = operatorAllowlist()

  if (!identity.verified) {
    return Response.json(
      {
        operator: false,
        reason: identity.reason,
        allowlistConfigured: allow.length > 0,
        message: 'Sign in required for operator gifts · solo Andres Medina',
        whoCanClaim: 'Andres Medina (Cursor email in OPERATOR_EMAILS / default allowlist)',
      },
      { headers: { 'cache-control': 'private, no-store' } },
    )
  }

  if (identity.kind === 'key') {
    return Response.json(
      {
        operator: false,
        reason: 'api_key',
        allowlistConfigured: true,
        message: 'API keys cannot claim operator gifts',
        whoCanClaim: 'Andres Medina only',
      },
      { headers: { 'cache-control': 'private, no-store' } },
    )
  }

  const email = (identity.email || '').trim().toLowerCase()
  const operator = email.length > 0 && allow.includes(email)

  return Response.json(
    {
      operator,
      email: email || undefined,
      name: identity.name || undefined,
      sub: identity.sub,
      allowlistConfigured: allow.length > 0,
      whoCanClaim: 'Andres Medina · camilo.medinaf24s@gmail.com (Cursor identity)',
      message: operator
        ? 'Operador autorizado · regalos disponibles'
        : 'Viewer email not in operator allowlist · regalos deshabilitados',
    },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
