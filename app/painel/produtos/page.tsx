import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'
import { PainelSidebar } from '@/components/painel-sidebar'
import { ProductList } from '@/components/product-list'
import { canUserSell, fetchSellerProducts } from '@/lib/products'
import { getSession, TOKEN_COOKIE } from '@/lib/session'

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
            : <ProductList initialProducts={result.products} />}
        </section>
      </section>
    </main>
  )
}