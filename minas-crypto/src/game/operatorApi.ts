/**
 * Operator gifts gate — Cursor identity allowlist (Andres only).
 * Unlock ONLY via POST /api/me/operator/claim (issue + consume).
 * GET /api/me/operator is status; never trust PLAYER brand or a client boolean.
 */

export type OperatorStatus = {
  operator: boolean
  email?: string
  name?: string
  sub?: string
  allowlistConfigured?: boolean
  message?: string
  reason?: string
  claimPath?: string
}

export type OperatorClaimResult = {
  ok: boolean
  consumed?: boolean
  issued?: boolean
  claimToken?: string
  message?: string
  reason?: string
  gifts?: Array<{ id: string; title: string; minerRank: number; axeId: number }>
}

let cached: OperatorStatus | null = null
let fetchedAt = 0

export async function fetchOperatorStatus(force = false): Promise<OperatorStatus> {
  const now = Date.now()
  if (!force && cached && now - fetchedAt < 60_000) return cached
  try {
    const res = await fetch('/api/me/operator', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    const data = (await res.json()) as OperatorStatus
    cached = {
      operator: Boolean(data.operator),
      email: data.email,
      name: data.name,
      sub: data.sub,
      allowlistConfigured: data.allowlistConfigured,
      message: data.message,
      reason: data.reason,
      claimPath: data.claimPath,
    }
    fetchedAt = now
    return cached
  } catch {
    cached = { operator: false, message: 'operator status fetch failed' }
    fetchedAt = now
    return cached
  }
}

/**
 * Server-side unlock: issue claimToken → consume claimToken.
 * Returns ok only when server consumed a valid one-time claim.
 */
export async function claimOperatorGiftsOnServer(): Promise<OperatorClaimResult> {
  try {
    const issueRes = await fetch('/api/me/operator/claim', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const issued = (await issueRes.json()) as OperatorClaimResult
    if (!issueRes.ok || !issued.ok || !issued.claimToken) {
      return {
        ok: false,
        message: issued.message || `claim issue ${issueRes.status}`,
        reason: issued.reason,
      }
    }
    const consumeRes = await fetch('/api/me/operator/claim', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimToken: issued.claimToken }),
    })
    const consumed = (await consumeRes.json()) as OperatorClaimResult
    if (!consumeRes.ok || !consumed.ok || !consumed.consumed) {
      return {
        ok: false,
        message: consumed.message || `claim consume ${consumeRes.status}`,
      }
    }
    return {
      ok: true,
      consumed: true,
      gifts: consumed.gifts,
      message: consumed.message,
    }
  } catch {
    return { ok: false, message: 'claim fetch failed' }
  }
}

export function bustOperatorCache(): void {
  cached = null
  fetchedAt = 0
}
