import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'n8n_session'
export const TOKEN_COOKIE = 'n8n_admin_token'

export type UserSession = {
  authenticated: true
  user: Record<string, unknown> & { is_admin: boolean }
}

function sessionSecret() {
  return process.env.N8N_SESSION_SECRET
}

export function createSessionValue(user: UserSession['user']) {
  const secret = sessionSecret()
  if (!secret) return null

  const payload = Buffer.from(JSON.stringify({ authenticated: true, user })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifySessionValue(value: string | undefined): UserSession | null {
  const secret = sessionSecret()
  if (!secret || !value) return null

  const separator = value.lastIndexOf('.')
  if (separator < 1) return null

  const payload = value.slice(0, separator)
  const receivedSignature = Buffer.from(value.slice(separator + 1), 'base64url')
  const expectedSignature = createHmac('sha256', secret).update(payload).digest()
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) return null

  try {
    const session: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!session || typeof session !== 'object' || Array.isArray(session)) return null
    const candidate = session as Partial<UserSession>
    if (candidate.authenticated !== true || !candidate.user || typeof candidate.user !== 'object' || typeof candidate.user.is_admin !== 'boolean') return null
    return candidate as UserSession
  } catch {
    return null
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  return verifySessionValue(cookieStore.get(SESSION_COOKIE)?.value)
}