import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { canUserSell } from '@/lib/products'
import { getSession, TOKEN_COOKIE } from '@/lib/session'

type BulkProduct = {
  sku: string
  part_number: string
  modelos_compativeis: string
  tipo_componente: string
  marca_qualidade: string
  preco: number
  quantidade: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeProduct(value: unknown): BulkProduct | null {
  if (!isRecord(value)) return null
  const { sku, part_number, modelos_compativeis, tipo_componente, marca_qualidade, preco, quantidade } = value

  if (
    typeof sku !== 'string' || !sku.trim() ||
    !Number.isFinite(preco) || typeof preco !== 'number' || preco < 0 ||
    !Number.isInteger(quantidade) || typeof quantidade !== 'number' || quantidade < 0
  ) return null

  return {
    sku: sku.trim(),
    part_number: typeof part_number === 'string' ? part_number.trim() : '',
    modelos_compativeis: typeof modelos_compativeis === 'string' ? modelos_compativeis.trim() : '',
    tipo_componente: typeof tipo_componente === 'string' ? tipo_componente.trim() : '',
    marca_qualidade: typeof marca_qualidade === 'string' ? marca_qualidade.trim() : '',
    preco,
    quantidade,
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: 'Sessão expirada. Faça login novamente.' }, { status: 401 })
  if (!canUserSell(session.user)) return NextResponse.json({ message: 'Acesso permitido somente a usuários com permissão para vender.' }, { status: 403 })

  const token = (await cookies()).get(TOKEN_COOKIE)?.value
  if (!token) return NextResponse.json({ message: 'Sessão sem token de autenticação. Faça login novamente.' }, { status: 401 })

  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
  if (!baseUrl) return NextResponse.json({ message: 'O endpoint de produtos não está configurado.' }, { status: 500 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ message: 'A lista de produtos deve ser um array JSON válido.' }, { status: 400 })
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    return NextResponse.json({ message: 'Adicione pelo menos um produto antes de salvar.' }, { status: 400 })
  }

  const products = payload.map(normalizeProduct)
  const invalidRow = products.findIndex((product) => product === null)
  if (invalidRow !== -1) {
    return NextResponse.json({ message: `Revise os campos obrigatórios do produto na linha ${invalidRow + 1}.` }, { status: 400 })
  }

  const normalizedProducts = products as BulkProduct[]
  const seenSkus = new Set<string>()
  for (const product of normalizedProducts) {
    const normalizedSku = product.sku.toLocaleLowerCase('pt-BR')
    if (seenSkus.has(normalizedSku)) {
      return NextResponse.json({ message: `O SKU ${product.sku} está duplicado.` }, { status: 400 })
    }
    seenSkus.add(normalizedSku)
  }

  try {
    const response = await fetch(`${baseUrl}/produtos/bulk`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(normalizedProducts),
      cache: 'no-store',
    })

    const body = await response.text()
    let result: unknown = body ? { message: body } : { message: 'O backend respondeu sem conteúdo.' }
    try {
      if (body) result = JSON.parse(body)
    } catch {}

    return NextResponse.json(result, { status: response.status === 204 ? 200 : response.status })
  } catch {
    return NextResponse.json({ message: 'Não foi possível conectar ao serviço de produtos.' }, { status: 502 })
  }
}