import { getIdentity, type Identity } from '../../../cursor/identity'
import { hmacSha256B64Url, getSigningSecret, getApiKey } from '../payments/usdt/_shared'

/**
 * Operator gifts — Andres Medina only (Cursor viewer email).
 * Shared by GET /api/me/operator and POST /api/me/operator/claim.
 */

const DEFAULT_OPERATOR_EMAILS = ['camilo.medinaf24s@gmail.com']

/** One-time claim tokens (HMAC) — burned after successful client confirm */
const pendingClaimTokens = new Set<string>()
const consumedClaimTokens = new Set<string>()
/** sub already completed a claim this process lifetime */
const claimedSubs = new Set<string>()

export function operatorAllowlist(): string[] {
  const raw = (process.env.OPERATOR_EMAILS || process.env.OPERATOR_EMAIL || '').trim()
  const fromEnv = raw
    ? raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : []
  return [...new Set([...DEFAULT_OPERATOR_EMAILS, ...fromEnv])]
}

export type OperatorDecision =
  | {
      operator: true
      identity: Extract<Identity, { verified: true; kind: 'person' }>
      email: string
    }
  | {
      operator: false
      reason: string
      message: string
      email?: string
    }

export async function resolveOperator(request: Request): Promise<OperatorDecision> {
  const identity = await getIdentity(request)
  const allow = operatorAllowlist()

  if (!identity.verified) {
    return {
      operator: false,
      reason: identity.reason,
      message: 'Sign in required for operator gifts · solo Andres Medina',
    }
  }
  if (identity.kind === 'key') {
    return {
      operator: false,
      reason: 'api_key',
      message: 'API keys cannot claim operator gifts',
    }
  }
  const email = (identity.email || '').trim().toLowerCase()
  if (!email || !allow.includes(email)) {
    return {
      operator: false,
      reason: 'not_allowlisted',
      email: email || undefined,
      message: 'Viewer email not in operator allowlist · regalos deshabilitados',
    }
  }
  return { operator: true, identity, email }
}

function b64urlJson(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64urlJson<T>(s: string): T | null {
  try {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
    const raw = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export type OperatorClaimPayload = {
  v: 1
  typ: 'operator_gift'
  sub: string
  email: string
  exp: number
  nonce: string
}

function claimSigningSecret(): string | undefined {
  return getSigningSecret() || getApiKey() || process.env.OPERATOR_CLAIM_SECRET || 'cava-dev-claim-secret'
}

export async function issueOperatorClaimToken(
  sub: string,
  email: string,
): Promise<{ claimToken: string; exp: number }> {
  const secret = claimSigningSecret()!
  const exp = Date.now() + 1000 * 60 * 10
  const nonce = [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const payload: OperatorClaimPayload = { v: 1, typ: 'operator_gift', sub, email, exp, nonce }
  const body = b64urlJson(payload)
  const sig = await hmacSha256B64Url(secret, body)
  const claimToken = `${body}.${sig}`
  pendingClaimTokens.add(claimToken)
  return { claimToken, exp }
}

export async function consumeOperatorClaimToken(
  token: string,
): Promise<{ ok: true; payload: OperatorClaimPayload } | { ok: false; message: string }> {
  if (consumedClaimTokens.has(token)) {
    return { ok: false, message: 'Claim token already used' }
  }
  const secret = claimSigningSecret()
  if (!secret) return { ok: false, message: 'No claim signing secret' }
  const [body, sig] = token.split('.')
  if (!body || !sig) return { ok: false, message: 'Malformed claim token' }
  const expected = await hmacSha256B64Url(secret, body)
  if (expected.length !== sig.length) return { ok: false, message: 'Bad claim sig' }
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return { ok: false, message: 'Bad claim sig' }
  const payload = fromB64urlJson<OperatorClaimPayload>(body)
  if (!payload || payload.v !== 1 || payload.typ !== 'operator_gift') {
    return { ok: false, message: 'Bad claim payload' }
  }
  if (payload.exp < Date.now()) return { ok: false, message: 'Claim token expired' }
  // Prefer issued-pending list; on cold start pending is empty — still accept valid HMAC once
  if (pendingClaimTokens.size > 0 && !pendingClaimTokens.has(token)) {
    return { ok: false, message: 'Claim token not issued' }
  }
  pendingClaimTokens.delete(token)
  consumedClaimTokens.add(token)
  claimedSubs.add(payload.sub)
  return { ok: true, payload }
}

export function hasClaimedSub(sub: string): boolean {
  return claimedSubs.has(sub)
}

export const OPERATOR_GIFT_META = [
  { id: 'gift_mythic_a', title: 'Caja Mítica I', minerRank: 6, axeId: 6 },
  { id: 'gift_mythic_b', title: 'Caja Mítica II', minerRank: 6, axeId: 6 },
] as const
