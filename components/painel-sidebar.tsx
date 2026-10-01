import { LayoutDashboard, Package } from 'lucide-react'
import Image from 'next/image'

type PainelSidebarProps = {
  active: 'overview' | 'products'
  showProducts?: boolean
}

export function PainelSidebar({ active, showProducts = true }: PainelSidebarProps) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand"><Image alt="Enitime" className="panel-brand-logo" height={34} src="/LogoEnitime.png" width={34} /><span>Enitime <strong>Panel</strong></span></div>
      <nav aria-label="Menu principal" className="admin-nav">
        <a aria-current={active === 'overview' ? 'page' : undefined} className={`admin-nav__item${active === 'overview' ? ' admin-nav__item--active' : ''}`} href="/painel">
          <LayoutDashboard aria-hidden="true" size={16} /> Visão geral
        </a>
        {showProducts && <a aria-current={active === 'products' ? 'page' : undefined} className={`admin-nav__item${active === 'products' ? ' admin-nav__item--active' : ''}`} href="/painel/produtos">
          <Package aria-hidden="true" size={16} /> Produtos
        </a>}
      </nav>
      <div className="admin-sidebar-footer"><span className="status-dot" /> Sessão ativa</div>
    </aside>
  )
}