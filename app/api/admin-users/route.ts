import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession, TOKEN_COOKIE } from '@/lib/session'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function GET() {
  const webhookBaseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
  const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/users` : undefined
  const session = await getSession()
  const token = (await cookies()).get(TOKEN_COOKIE)?.value

  if (!webhookUrl) return NextResponse.json({ message: 'O endpoint de usuários não está configurado.' }, { status: 500 })
  if (!session) return NextResponse.json({ message: 'Sessão expirada. Faça login novamente.' }, { status: 401 })
  if (!session.user.is_admin) return NextResponse.json({ message: 'Acesso permitido somente para administradores.' }, { status: 403 })

  try {
    const response = await fetch(webhookUrl, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/json' },
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
  const session = await getSession()
  const token = (await cookies()).get(TOKEN_COOKIE)?.value

  if (!webhookUrl) return NextResponse.json({ message: 'O endpoint de usuários não está configurado.' }, { status: 500 })
  if (!session) return NextResponse.json({ message: 'Sessão expirada. Faça login novamente.' }, { status: 401 })
  if (!session.user.is_admin) return NextResponse.json({ message: 'Acesso permitido somente para administradores.' }, { status: 403 })

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
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function PATCH(request: Request) {
  const webhookBaseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
  const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/users` : undefined
  const session = await getSession()
  const token = (await cookies()).get(TOKEN_COOKIE)?.value

  if (!webhookUrl) return NextResponse.json({ message: 'O endpoint de usuários não está configurado.' }, { status: 500 })
  if (!session) return NextResponse.json({ message: 'Sessão expirada. Faça login novamente.' }, { status: 401 })
  if (!session.user.is_admin) return NextResponse.json({ message: 'Acesso permitido somente para administradores.' }, { status: 403 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ message: 'Os dados do usuário são inválidos.' }, { status: 400 })
  }

  if (!isRecord(payload) || (typeof payload.id !== 'string' && typeof payload.id !== 'number') || !String(payload.id).trim()) {
    return NextResponse.json({ message: 'Informe um ID de usuário válido.' }, { status: 400 })
  }

  const allowedFields = ['nome', 'telegram_chat_id', 'whatsapp_id', 'pode_comprar', 'pode_vender']
  const updates: Record<string, string | boolean> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'id') continue
    if (!allowedFields.includes(key)) return NextResponse.json({ message: `O campo ${key} não pode ser editado.` }, { status: 400 })

    if (key === 'pode_comprar' || key === 'pode_vender') {
      if (typeof value !== 'boolean') return NextResponse.json({ message: `O campo ${key} deve ser verdadeiro ou falso.` }, { status: 400 })
      updates[key] = value
      continue
    }

    if (typeof value !== 'string' || (key === 'nome' && !value.trim())) {
      return NextResponse.json({ message: `O campo ${key} é inválido.` }, { status: 400 })
    }
    updates[key] = value.trim()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: 'Informe ao menos um campo para atualizar.' }, { status: 400 })
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'PATCH',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ id: String(payload.id).trim(), ...updates }),
      cache: 'no-store',
    })
    if (response.status === 204) return NextResponse.json({ message: 'Usuário atualizado.' })

    const contentType = response.headers.get('content-type') ?? ''
    const result = contentType.includes('application/json') ? await response.json() : { message: await response.text() }
    return NextResponse.json(result, { status: response.status })
  } catch {
    return NextResponse.json({ message: 'Não foi possível atualizar o usuário.' }, { status: 502 })
  }
}
