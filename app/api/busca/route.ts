import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ message: 'Os dados da busca são inválidos.' }, { status: 400 })
    }

    const baseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
    if (!baseUrl) {
      return NextResponse.json({ message: 'N8N_WEBHOOK_BASE_URL não configurado.' }, { status: 500 })
    }

    const candidateUrls = [`${baseUrl}/buscar`, `${baseUrl}/search`, `${baseUrl}/busca`]
    let lastResult: { status: number; message: string } | null = null

    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
        })

        const contentType = response.headers.get('content-type') ?? ''
        const result = contentType.includes('application/json') ? await response.json() : { message: await response.text() }

        if (response.ok) {
          return NextResponse.json(result, { status: response.status })
        }

        lastResult = { status: response.status, message: result?.message ?? 'Falha ao buscar peças.' }
      } catch {
        lastResult = { status: 502, message: 'Não foi possível processar a busca.' }
      }
    }

    return NextResponse.json(lastResult ?? { message: 'Não foi possível processar a busca.' }, { status: lastResult?.status ?? 502 })
  } catch {
    return NextResponse.json({ message: 'Erro ao processar a busca.' }, { status: 502 })
  }
}
