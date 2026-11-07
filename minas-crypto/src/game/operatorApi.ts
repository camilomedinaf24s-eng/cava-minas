/**
 * Operator gifts gate — Cursor identity allowlist (Andres only).
 * GET /api/me/operator · never trust PLAYER brand string alone.
 */

export type OperatorStatus = {
  operator: boolean
  email?: string
  name?: string
  sub?: string
  allowlistConfigured?: boolean
  message?: string
  reason?: string
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
    }
    fetchedAt = now
    return cached
  } catch {
    cached = { operator: false, message: 'operator status fetch failed' }
    fetchedAt = now
    return cached
  }
}

export function bustOperatorCache(): void {
  cached = null
  fetchedAt = 0
}
