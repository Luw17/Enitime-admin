import { NextResponse } from 'next/server'

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

    const contentType = response.headers.get('content-type') ?? ''
    const result = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() }

    if (response.ok) {
      const token = result?.token ?? result?.jwt ?? result?.access_token ?? result?.accessToken
      if (!token || typeof token !== 'string') {
        return NextResponse.json({ message: 'O login não retornou um token de acesso.' }, { status: 502 })
      }

      const nextResponse = NextResponse.json(result, { status: response.status })
      nextResponse.cookies.set('n8n_admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8,
      })
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
