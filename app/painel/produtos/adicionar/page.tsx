import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BulkProductEditor } from '@/components/bulk-product-editor'
import { LogoutButton } from '@/components/logout-button'
import { PainelSidebar } from '@/components/painel-sidebar'
import { canUserSell } from '@/lib/products'
import { getSession } from '@/lib/session'

export default async function AddProductsPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.user.is_admin) redirect('/admin')
  if (!canUserSell(session.user)) redirect('/painel')

  return (
    <main className="admin-layout">
      <PainelSidebar active="products" />
      <section className="admin-content">
        <header className="admin-header">
          <div><p className="eyebrow">Gestão de estoque</p><h1>Adicionar produtos</h1><p>Cadastre vários itens de estoque de uma vez.</p></div>
          <div className="admin-header-actions"><Link aria-label="Voltar para produtos" className="icon-action-button" href="/painel/produtos" title="Voltar para produtos"><ArrowLeft aria-hidden="true" size={17} /></Link><LogoutButton /></div>
        </header>
        <BulkProductEditor />
      </section>
    </main>
  )
}