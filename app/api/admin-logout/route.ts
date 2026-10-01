import { NextResponse } from 'next/server'
import { SESSION_COOKIE, TOKEN_COOKIE } from '@/lib/session'

export async function POST() {
  const response = NextResponse.json({ success: true })
  for (const name of [SESSION_COOKIE, TOKEN_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  }
  return response
}