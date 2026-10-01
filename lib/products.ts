export type ProductRecord = Record<string, unknown>

export type ProductListResult = {
  products: ProductRecord[]
  error: string
}

export function canUserSell(user: Record<string, unknown>) {
  const value = user.pode_vender
  return value === true || (typeof value === 'string' && value.trim().replace(/^=/, '').toLowerCase() === 'true')
}

export function productRecords(value: unknown): ProductRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is ProductRecord => item !== null && typeof item === 'object' && !Array.isArray(item))
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []

  const record = value as ProductRecord
  for (const key of ['products', 'produtos', 'data', 'items']) {
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[]).filter((item): item is ProductRecord => item !== null && typeof item === 'object' && !Array.isArray(item))
    }
  }

  return Object.keys(record).length ? [record] : []
}

export async function fetchSellerProducts(id: string, token?: string): Promise<ProductListResult> {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
  if (!baseUrl) return { products: [], error: 'O endpoint de produtos não está configurado.' }

  try {
    const url = new URL(`${baseUrl}/produtos`)
    url.searchParams.set('id', id)
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const details = process.env.NODE_ENV === 'development' ? ` (HTTP ${response.status})` : ''
      return { products: [], error: `${response.status === 401 ? 'Sua sessão não está autorizada a consultar os produtos.' : 'Não foi possível carregar seus produtos.'}${details}` }
    }

    const body = await response.text()
    if (!body.trim()) return { products: [], error: '' }

    try {
      return { products: productRecords(JSON.parse(body)), error: '' }
    } catch {
      return { products: [], error: 'O serviço de produtos retornou uma resposta inválida.' }
    }
  } catch {
    return { products: [], error: 'Não foi possível conectar ao serviço de produtos.' }
  }
}