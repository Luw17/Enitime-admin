'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'

type UserRecord = Record<string, unknown>

async function requestUsers(): Promise<UserRecord[]> {
  const response = await fetch('/api/admin-users', { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result?.message ?? 'Não foi possível carregar os usuários.')
  const records: unknown[] = Array.isArray(result) ? result : Array.isArray(result?.users) ? result.users : Array.isArray(result?.data) ? result.data : [result]
  return records.filter((item): item is UserRecord => item !== null && typeof item === 'object')
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    requestUsers()
      .then(setUsers)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Erro ao carregar usuários.'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!isCreateModalOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) setIsCreateModalOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isCreateModalOpen, isSaving])

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setIsSaving(true)
    setSaveError('')

    try {
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.get('nome'),
          tipo: formData.get('tipo'),
          senha: formData.get('senha'),
          telegram_chat_id: formData.get('telegram_chat_id'),
          whatsapp_id: formData.get('whatsapp_id'),
          origem_cadastro: 'painel',
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message ?? 'Não foi possível cadastrar o usuário.')

      setIsCreateModalOpen(false)
      form.reset()
      try {
        setUsers(await requestUsers())
        setError('')
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Usuário cadastrado, mas não foi possível atualizar a lista.')
      }
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar o usuário.')
    } finally {
      setIsSaving(false)
    }
  }

  const columns = users.length ? Object.keys(users[0]) : []

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><span className="sidebar-brand-mark">n8</span><span>Admin <strong>Console</strong></span></div>
        <nav aria-label="Menu principal" className="admin-nav">
          <a className="admin-nav__item admin-nav__item--active" href="#usuarios"><span aria-hidden="true">◈</span> Usuários</a>
          <a className="admin-nav__item" href="#configuracoes"><span aria-hidden="true">⚙</span> Configurações</a>
        </nav>
        <div className="admin-sidebar-footer"><span className="status-dot" /> Sessão ativa</div>
      </aside>

      <section className="admin-content" id="usuarios">
        <header className="admin-header"><div><p className="eyebrow">Gerenciamento</p><h1>Usuários</h1><p>Visualize os usuários cadastrados na sua aplicação n8n.</p></div><div className="admin-avatar" aria-label="Administrador">A</div></header>
        <div className="users-card">
          <div className="users-card__header"><div><h2>Todos os usuários</h2><p>{isLoading ? 'Carregando registros...' : `${users.length} registro${users.length === 1 ? '' : 's'} encontrado${users.length === 1 ? '' : 's'}`}</p></div><div className="users-card__actions"><button className="refresh-button" type="button" onClick={() => { setIsLoading(true); requestUsers().then((records) => { setUsers(records); setError('') }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Erro ao carregar usuários.')).finally(() => setIsLoading(false)) }}>Atualizar</button><button className="create-user-button" type="button" onClick={() => { setSaveError(''); setIsCreateModalOpen(true) }}><Plus aria-hidden="true" size={15} /> Cadastrar usuário</button></div></div>
          {isLoading && <div className="table-state">Carregando usuários...</div>}
          {error && <div className="table-state table-state--error" role="alert">{error}</div>}
          {!isLoading && !error && users.length === 0 && <div className="table-state">Nenhum usuário encontrado.</div>}
          {!isLoading && !error && users.length > 0 && <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{users.map((user, index) => <tr key={index}>{columns.map((column) => <td key={column}>{formatValue(user[column])}</td>)}</tr>)}</tbody></table></div>}
        </div>
      </section>
      {isCreateModalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setIsCreateModalOpen(false) }}>
        <section aria-labelledby="create-user-title" aria-modal="true" className="create-user-modal" role="dialog">
          <header className="create-user-modal__header"><div><p className="eyebrow">Novo registro</p><h2 id="create-user-title">Cadastrar usuário</h2></div><button aria-label="Fechar" className="modal-close-button" disabled={isSaving} onClick={() => setIsCreateModalOpen(false)} type="button"><X aria-hidden="true" size={18} /></button></header>
          <form className="create-user-form" onSubmit={handleCreateUser}>
            <label className="create-user-field"><span>Nome <b>*</b></span><input autoFocus autoComplete="organization" name="nome" placeholder="Ex.: Loja Exemplo" required /></label>
            <label className="create-user-field"><span>Tipo <b>*</b></span><span className="create-user-select"><select defaultValue="loja" name="tipo" required><option value="loja">Loja</option><option value="admin">Admin</option><option value="comprador">Comprador</option></select><ChevronDown aria-hidden="true" className="create-user-select__icon" size={16} /></span></label>
            <label className="create-user-field"><span>Senha <b>*</b></span><input autoComplete="new-password" name="senha" type="password" required /></label>
            <label className="create-user-field"><span>Telegram Chat ID</span><input autoComplete="off" name="telegram_chat_id" placeholder="Opcional" /></label>
            <label className="create-user-field"><span>WhatsApp ID</span><input autoComplete="off" name="whatsapp_id" placeholder="Opcional" /></label>
            {saveError && <p className="create-user-error" role="alert">{saveError}</p>}
            <footer className="create-user-modal__footer"><span className="required-note">* Obrigatório</span><div><button className="refresh-button" disabled={isSaving} onClick={() => setIsCreateModalOpen(false)} type="button">Cancelar</button><button className="create-user-button" disabled={isSaving} type="submit">{isSaving ? 'Cadastrando...' : 'Cadastrar'}</button></div></footer>
          </form>
        </section>
      </div>}
    </main>
  )
}
