import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'
import { getSession } from '@/lib/session'

const profileFields: Record<string, string> = {
  id: 'ID',
  nome: 'Nome',
  nome_loja: 'Nome da loja',
  telegram_chat_id: 'Telegram Chat ID',
  whatsapp_id: 'WhatsApp ID',
  pode_comprar: 'Pode comprar',
  pode_vender: 'Pode vender',
  status: 'Status',
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Não informado'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default async function UserDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.user.is_admin) redirect('/admin')

  const visibleFields = Object.entries(session.user).filter(([key]) => key !== 'is_admin')

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><span className="sidebar-brand-mark">n8</span><span>n8n <strong>Painel</strong></span></div>
        <nav aria-label="Menu principal" className="admin-nav">
          <a className="admin-nav__item admin-nav__item--active" href="#visao-geral"><span aria-hidden="true">◈</span> Visão geral</a>
        </nav>
        <div className="admin-sidebar-footer"><span className="status-dot" /> Sessão ativa</div>
      </aside>

      <section className="admin-content" id="visao-geral">
        <header className="admin-header">
          <div><p className="eyebrow">Sua conta</p><h1>Visão geral</h1><p>Informações e permissões da sua conta.</p></div>
          <LogoutButton />
        </header>
        <section aria-labelledby="profile-title" className="profile-section">
          <header className="profile-section__header"><h2 id="profile-title">Dados da conta</h2><span className="profile-status"><span className="status-dot" /> {displayValue(session.user.status ?? 'Ativo')}</span></header>
          <dl className="profile-grid">
            {visibleFields.map(([key, value]) => (
              <div className="profile-field" key={key}>
                <dt>{profileFields[key] ?? key.replaceAll('_', ' ')}</dt>
                <dd>{displayValue(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </section>
    </main>
  )
}