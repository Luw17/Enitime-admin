import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const webhookBaseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
  const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/users` : undefined
  const token = (await cookies()).get('n8n_admin_token')?.value

  if (!webhookUrl) return NextResponse.json({ message: 'O endpoint de usuários não está configurado.' }, { status: 500 })
  if (!token) return NextResponse.json({ message: 'Sessão expirada. Faça login novamente.' }, { status: 401 })

  try {
    const response = await fetch(webhookUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const contentType = response.headers.get('content-type') ?? ''
    const result = contentType.includes('application/json') ? await response.json() : { message: await response.text() }
    return NextResponse.json(result, { status: response.status })
  } catch {
    return NextResponse.json({ message: 'Não foi possível carregar os usuários.' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const webhookBaseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
  const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/users` : undefined
  const token = (await cookies()).get('n8n_admin_token')?.value

  if (!webhookUrl) return NextResponse.json({ message: 'O endpoint de usuários não está configurado.' }, { status: 500 })
  if (!token) return NextResponse.json({ message: 'Sessão expirada. Faça login novamente.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    const payload: unknown = await request.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ message: 'Os dados do usuário são inválidos.' }, { status: 400 })
    }
    body = payload as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: 'Os dados do usuário são inválidos.' }, { status: 400 })
  }

  const { nome, tipo, senha, telegram_chat_id, whatsapp_id } = body
  if (
    typeof nome !== 'string' || !nome.trim() ||
    typeof tipo !== 'string' || !tipo.trim() ||
    typeof senha !== 'string' || !senha
  ) {
    return NextResponse.json({ message: 'Nome, tipo e senha são obrigatórios.' }, { status: 400 })
  }

  const userPayload = {
    nome: nome.trim(),
    tipo: tipo.trim(),
    senha,
    telegram_chat_id: typeof telegram_chat_id === 'string' ? telegram_chat_id.trim() : '',
    whatsapp_id: typeof whatsapp_id === 'string' ? whatsapp_id.trim() : '',
    origem_cadastro: 'painel',
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(userPayload),
      cache: 'no-store',
    })
    const contentType = response.headers.get('content-type') ?? ''
    const result = contentType.includes('application/json') ? await response.json() : { message: await response.text() }
    return NextResponse.json(result, { status: response.status })
  } catch {
    return NextResponse.json({ message: 'Não foi possível cadastrar o usuário.' }, { status: 502 })
  }
}
