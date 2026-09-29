import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Envia os dados para o webhook do n8n configurado via `N8N_WEBHOOK_BASE_URL` + '/registrar'
    const webhookBase = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
    if (!webhookBase) {
      return NextResponse.json({ message: 'N8N_WEBHOOK_BASE_URL não configurado.' }, { status: 500 })
    }

    const resp = await fetch(`${webhookBase}/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const contentType = resp.headers.get('content-type') ?? ''
    const result = contentType.includes('application/json') ? await resp.json() : { message: await resp.text() }

    return NextResponse.json(result, { status: resp.status })
  } catch (err) {
    return NextResponse.json({ message: 'Erro ao processar o registro.' }, { status: 502 })
  }
}
