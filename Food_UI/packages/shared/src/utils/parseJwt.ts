export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(payload)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function extractPermissions(token: string): Record<string, boolean> | undefined {
  const payload = parseJwtPayload(token)
  if (!payload) return undefined
  const raw = payload['permission']
  if (!raw) return undefined
  const modules: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string' ? [raw] : []
  if (modules.length === 0) return undefined
  return Object.fromEntries(modules.map((m) => [m, true])) as Record<string, boolean>
}

export function extractRole(token: string): string {
  const payload = parseJwtPayload(token)
  if (!payload) return ''
  return (
    (payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] as string) ??
    (payload['role'] as string) ?? ''
  )
}
