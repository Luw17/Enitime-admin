import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { canUserSell } from '@/lib/products'
import { getSession, TOKEN_COOKIE } from '@/lib/session'
import { parseCompatibleModels } from '@/lib/model-tags'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: 'Sessão expirada. Faça login novamente.' }, { status: 401 })
  if (!canUserSell(session.user)) return NextResponse.json({ message: 'Acesso permitido somente a usuários com permissão para vender.' }, { status: 403 })

  const token = (await cookies()).get(TOKEN_COOKIE)?.value
  if (!token) return NextResponse.json({ message: 'Sessão sem token de autenticação. Faça login novamente.' }, { status: 401 })

  const sellerId = session.user.id
  if ((typeof sellerId !== 'string' && typeof sellerId !== 'number') || !String(sellerId).trim()) {
    return NextResponse.json({ message: 'Não foi possível identificar a loja desta sessão.' }, { status: 401 })
  }
  const supplierId = typeof sellerId === 'string' ? sellerId.trim() : sellerId

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ message: 'Os dados do produto são inválidos.' }, { status: 400 })
  }

  if (!isRecord(payload) || (typeof payload.id !== 'string' && typeof payload.id !== 'number') || !String(payload.id).trim()) {
    return NextResponse.json({ message: 'Informe um ID de produto válido.' }, { status: 400 })
  }

  const allowedFields = ['part_number', 'modelos_compativeis', 'tipo_componente', 'marca_qualidade', 'preco', 'quantidade']
  const updates: Record<string, string | number | string[]> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'id') continue
    if (!allowedFields.includes(key)) return NextResponse.json({ message: `O campo ${key} não pode ser editado.` }, { status: 400 })

    if (key === 'preco') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return NextResponse.json({ message: 'O preço deve ser um número maior ou igual a zero.' }, { status: 400 })
      }
      updates[key] = value
      continue
    }

    if (key === 'quantidade') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        return NextResponse.json({ message: 'A quantidade deve ser um inteiro maior ou igual a zero.' }, { status: 400 })
      }
      updates[key] = value
      continue
    }

    if (key === 'modelos_compativeis') {
      if (!Array.isArray(value) && typeof value !== 'string') return NextResponse.json({ message: `O campo ${key} é inválido.` }, { status: 400 })
      updates[key] = parseCompatibleModels(value)
      continue
    }

    if (typeof value !== 'string') return NextResponse.json({ message: `O campo ${key} é inválido.` }, { status: 400 })
    updates[key] = value.trim()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: 'Informe ao menos um campo para atualizar.' }, { status: 400 })
  }

  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
  if (!baseUrl) return NextResponse.json({ message: 'O endpoint de produtos não está configurado.' }, { status: 500 })

  try {
    const url = new URL(`${baseUrl}/produtos`)
    url.searchParams.set('id', String(supplierId))
    const webhookUpdates = { ...updates }
    if ('part_number' in webhookUpdates) {
      webhookUpdates.codigo_peca = webhookUpdates.part_number
      delete webhookUpdates.part_number
    }
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ id: String(payload.id).trim(), fornecedor_id: supplierId, ...webhookUpdates }),
      cache: 'no-store',
    })
    if (response.status === 204) return NextResponse.json({ message: 'Produto atualizado.' })

    const contentType = response.headers.get('content-type') ?? ''
    const result = contentType.includes('application/json') ? await response.json() : { message: await response.text() }
    return NextResponse.json(result, { status: response.status })
  } catch {
    return NextResponse.json({ message: 'Não foi possível atualizar o produto.' }, { status: 502 })
  }
}