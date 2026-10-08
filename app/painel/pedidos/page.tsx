import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'
import { PainelSidebar } from '@/components/painel-sidebar'
import { canUserSell } from '@/lib/products'
import { fetchSellerOrders, type OrderRecord } from '@/lib/orders'
import { getSession, TOKEN_COOKIE } from '@/lib/session'

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Não informado'
  return String(value)
}

function formatDate(value: unknown) {
  if (typeof value !== 'string') return 'Não informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function formatDistance(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Não informado'
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
}

function OrderRows({ orders }: { orders: OrderRecord[] }) {
  return <div className="products-table-wrap"><table className="products-table"><thead><tr>
    <th>Pedido</th><th>Recebido em</th><th>Comprador</th><th>Telefone</th><th>Peça</th><th>Qtd.</th><th>Distância</th><th>Status</th><th>Observação</th>
  </tr></thead><tbody>{orders.map((order, index) => <tr key={String(order.id ?? index)}>
    <td>#{displayValue(order.id)}</td>
    <td>{formatDate(order.criado_em)}</td>
    <td>{displayValue(order.comprador_nome)}</td>
    <td>{displayValue(order.comprador_telefone)}</td>
    <td>{displayValue(order.descricao_peca)}</td>
    <td>{displayValue(order.quantidade)}</td>
    <td>{formatDistance(order.distancia_km)}</td>
    <td>{displayValue(order.status)}</td>
    <td>{displayValue(order.observacao)}</td>
  </tr>)}</tbody></table></div>
}

export default async function OrdersPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.user.is_admin) redirect('/admin')
  if (!canUserSell(session.user)) redirect('/painel')

  const id = session.user.id
  const userId = typeof id === 'string' || typeof id === 'number' ? String(id).trim() : ''
  const token = (await cookies()).get(TOKEN_COOKIE)?.value
  const result = userId
    ? await fetchSellerOrders(userId, token)
    : { orders: [], error: 'Não foi possível identificar o ID da sua conta.' }

  return (
    <main className="admin-layout">
      <PainelSidebar active="orders" />
      <section className="admin-content">
        <header className="admin-header">
          <div><p className="eyebrow">Vendas da loja</p><h1>Pedidos</h1><p>Acompanhe os pedidos enviados para sua loja.</p></div>
          <LogoutButton />
        </header>

        <section aria-labelledby="orders-list-title" className="users-card products-table-card">
          <header className="users-card__header"><div><h2 id="orders-list-title">Pedidos recebidos</h2><p>{result.error ? 'Não foi possível atualizar a lista' : `${result.orders.length} pedido${result.orders.length === 1 ? '' : 's'}`}</p></div></header>
          {result.error
            ? <p className="products-state products-state--error" role="alert">{result.error}</p>
            : result.orders.length === 0
              ? <p className="products-state">Nenhum pedido encontrado.</p>
              : <OrderRows orders={result.orders} />}
        </section>
      </section>
    </main>
  )
}