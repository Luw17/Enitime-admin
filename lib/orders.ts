export type OrderRecord = Record<string, unknown>

export type OrderListResult = {
  orders: OrderRecord[]
  error: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function fetchSellerOrders(id: string, token?: string): Promise<OrderListResult> {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, '')
  if (!baseUrl) return { orders: [], error: 'O endpoint de pedidos não está configurado.' }
  if (!token) return { orders: [], error: 'Sua sessão não possui token de autenticação.' }

  const orders: OrderRecord[] = []
  let totalPages = 1

  try {
    for (let page = 1; page <= totalPages; page += 1) {
      const url = new URL(`${baseUrl}/pedidos-fornecedor`)
      url.searchParams.set('fornecedor_id', id)
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', '100')

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const details = process.env.NODE_ENV === 'development' ? ` (HTTP ${response.status})` : ''
        const message = response.status === 401
          ? 'Sua sessão não está autorizada a consultar os pedidos.'
          : 'Não foi possível carregar seus pedidos.'
        return { orders: [], error: `${message}${details}` }
      }

      let body: unknown
      try {
        body = await response.json()
      } catch {
        return { orders: [], error: 'O serviço de pedidos retornou uma resposta inválida.' }
      }

      if (!isRecord(body)) {
        return { orders: [], error: 'O serviço de pedidos retornou uma resposta inválida.' }
      }
      if (body.sucesso === false) {
        const message = typeof body.mensagem === 'string' ? body.mensagem : 'Não foi possível carregar seus pedidos.'
        return { orders: [], error: message }
      }
      if (!Array.isArray(body.pedidos) || !isRecord(body.paginacao)) {
        return { orders: [], error: 'O serviço de pedidos retornou uma resposta inválida.' }
      }

      orders.push(...body.pedidos.filter(isRecord))

      if (page === 1) {
        const pageCount = body.paginacao.total_paginas
        if (typeof pageCount !== 'number' || !Number.isInteger(pageCount) || pageCount < 0) {
          return { orders: [], error: 'O serviço de pedidos retornou uma paginação inválida.' }
        }
        totalPages = Math.max(1, pageCount)
      }
    }

    return { orders, error: '' }
  } catch {
    return { orders: [], error: 'Não foi possível conectar ao serviço de pedidos.' }
  }
}