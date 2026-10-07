import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ message: 'Os dados do checkout são inválidos.' }, { status: 400 })
    }

    const baseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
    if (!baseUrl) {
      return NextResponse.json({ message: 'N8N_WEBHOOK_BASE_URL não configurado.' }, { status: 500 })
    }

    const response = await fetch(`${baseUrl}/checkout-carrinho`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const contentType = response.headers.get('content-type') ?? ''
    const result = contentType.includes('application/json') ? await response.json() : { message: await response.text() }

    if (!response.ok) {
      return NextResponse.json(result ?? { message: 'Não foi possível finalizar o pedido.' }, { status: response.status })
    }

    return NextResponse.json(result, { status: response.status })
  } catch {
    return NextResponse.json({ message: 'Erro ao processar o checkout.' }, { status: 502 })
  }
}
