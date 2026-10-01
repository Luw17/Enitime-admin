import { NextResponse } from 'next/server'
import { createSessionValue, SESSION_COOKIE, TOKEN_COOKIE } from '@/lib/session'
import type { UserSession } from '@/lib/session'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isAuthenticatedUser(value: unknown): value is Record<string, unknown> & { is_admin: boolean } {
  return isRecord(value) && typeof value.is_admin === 'boolean'
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return null

  const normalized = value.trim().replace(/^=/, '').toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return null
}

function userFromToken(token: string): UserSession['user'] | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null

  try {
    const claims: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (!isRecord(claims)) return null

    const isAdmin = normalizeBoolean(claims.is_admin)
    if (isAdmin === null) return null

    const user = { ...claims }
    for (const key of ['iat', 'exp', 'nbf', 'iss', 'aud', 'sub', 'jti']) delete user[key]
    for (const [key, value] of Object.entries(user)) {
      if (typeof value === 'string' && value.startsWith('=')) user[key] = value.slice(1)
      if (['is_admin', 'pode_comprar', 'pode_vender'].includes(key)) {
        const normalized = normalizeBoolean(value)
        if (normalized !== null) user[key] = normalized
      }
    }
    user.is_admin = isAdmin
    return user as UserSession['user']
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const webhookBaseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
  const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/login` : undefined

  if (!webhookUrl) {
    return NextResponse.json(
      { message: 'O endpoint de autenticação não está configurado.' },
      { status: 500 },
    )
  }

  try {
    const body = await request.json()
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const responseBody = await response.text()
    let result: unknown
    try {
      result = JSON.parse(responseBody)
    } catch {
      result = { message: responseBody }
    }

    let loginResult: unknown = Array.isArray(result) ? result[0] : result
    if (typeof loginResult === 'string') {
      try {
        loginResult = JSON.parse(loginResult)
      } catch {}
    }
    if (Array.isArray(loginResult)) loginResult = loginResult[0]

    if (response.ok) {
      const loginData = isRecord(loginResult) ? loginResult : null
      const tokenValue = loginData?.token ?? loginData?.jwt ?? loginData?.access_token ?? loginData?.accessToken
      const token = typeof tokenValue === 'string' ? tokenValue : ''
      const directUser = isAuthenticatedUser(loginData?.user) ? loginData.user : null
      const tokenUser = token ? userFromToken(token) : null
      const user = directUser ?? tokenUser
      if (
        (loginData?.authenticated !== true && !tokenUser) ||
        !user
      ) {
        return NextResponse.json({ message: 'O login não retornou um perfil válido.' }, { status: 502 })
      }

      const sessionValue = createSessionValue(user)
      if (!sessionValue) {
        return NextResponse.json({ message: 'A variável N8N_SESSION_SECRET não está configurada no servidor.' }, { status: 500 })
      }

      const nextResponse = NextResponse.json({ authenticated: true, user }, { status: response.status })
      nextResponse.cookies.set(SESSION_COOKIE, sessionValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8,
      })
      if (token) {
        nextResponse.cookies.set(TOKEN_COOKIE, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 8,
        })
      } else {
        nextResponse.cookies.set(TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
      }
      return nextResponse
    }

    return NextResponse.json(result, { status: response.status })
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível conectar ao servidor de autenticação.' },
      { status: 502 },
    )
  }
}
