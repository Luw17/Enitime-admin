import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'
import { PainelSidebar } from '@/components/painel-sidebar'
import { canUserSell, fetchSellerProducts } from '@/lib/products'
import { getSession, TOKEN_COOKIE } from '@/lib/session'

const labels: Record<string, string> = {
  sku: 'SKU',
  part_number: 'Part Number',
  modelos_compativeis: 'Modelos compatíveis',
  tipo_componente: 'Tipo de componente',
  marca_qualidade: 'Marca/qualidade',
  preco: 'Preço (R$)',
  quantidade: 'Quantidade',
  estoque: 'Estoque',
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default async function ProductsPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.user.is_admin) redirect('/admin')
  if (!canUserSell(session.user)) redirect('/painel')

  const id = session.user.id
  const userId = typeof id === 'string' || typeof id === 'number' ? String(id).trim() : ''
  const token = (await cookies()).get(TOKEN_COOKIE)?.value
  const result = userId
    ? await fetchSellerProducts(userId, token)
    : { products: [], error: 'Não foi possível identificar o ID da sua conta.' }
  const productKeys = Array.from(new Set(result.products.flatMap((product) => Object.keys(product))))
    .filter((key) => !['id', 'fornecedorid'].includes(key.toLowerCase().replace(/[\s_-]/g, '')))

  return (
    <main className="admin-layout">
      <PainelSidebar active="products" />
      <section className="admin-content">
        <header className="admin-header">
          <div><p className="eyebrow">Gestão de estoque</p><h1>Produtos</h1><p>Consulte os produtos cadastrados para sua loja.</p></div>
          <div className="admin-header-actions"><Link className="create-user-button" href="/painel/produtos/adicionar"><Plus aria-hidden="true" size={15} /> Adicionar produtos</Link><LogoutButton /></div>
        </header>

        <section aria-labelledby="product-list-title" className="users-card products-table-card">
          <header className="users-card__header"><div><h2 id="product-list-title">Estoque da loja</h2><p>{result.error ? 'Não foi possível atualizar a lista' : `${result.products.length} produto${result.products.length === 1 ? '' : 's'}`}</p></div></header>
          {result.error
            ? <p className="products-state products-state--error" role="alert">{result.error}</p>
            : result.products.length === 0
              ? <div className="table-state">Nenhum produto encontrado.</div>
              : <div className="products-table-wrap"><table className="products-table"><thead><tr>{productKeys.map((key) => <th key={key}>{labels[key] ?? key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{result.products.map((product, index) => <tr key={String(product.id ?? product.sku ?? index)}>{productKeys.map((key) => <td key={key}>{displayValue(product[key])}</td>)}</tr>)}</tbody></table></div>}
        </section>
      </section>
    </main>
  )
}