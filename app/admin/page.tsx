'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import IMask from 'imask'
import { ChevronDown, Pencil, Plus, X } from 'lucide-react'
import Image from 'next/image'
import { LogoutButton } from '@/components/logout-button'

type UserRecord = Record<string, unknown>

async function requestUsers(): Promise<UserRecord[]> {
  const response = await fetch('/api/admin-users', { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result?.message ?? 'Não foi possível carregar os usuários.')
  const records: unknown[] = Array.isArray(result) ? result : Array.isArray(result?.users) ? result.users : Array.isArray(result?.data) ? result.data : [result]
  return records.filter((item): item is UserRecord => item !== null && typeof item === 'object')
}

const columnLabels: Record<string, string> = {
  id: 'ID',
  nome: 'Nome',
  nome_loja: 'Nome da loja',
  telegram_chat_id: 'Telegram Chat ID',
  whatsapp_id: 'WhatsApp ID',
  criado_em: 'Criado em',
  pode_comprar: 'Pode comprar',
  pode_vender: 'Pode vender',
  status: 'Status',
  is_admin: 'Administrador',
}

function formatValue(value: unknown, key: string) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (key === 'criado_em' && typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isEnabled(value: unknown) {
  return value === true || (typeof value === 'string' && value.trim().replace(/^=/, '').toLowerCase() === 'true')
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')

  useEffect(() => {
    requestUsers()
      .then(setUsers)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Erro ao carregar usuários.'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!isCreateModalOpen) return
    const cepInput = document.querySelector('input[name="cep"]') as HTMLInputElement | null
    const phoneInput = document.querySelector('input[name="phone"]') as HTMLInputElement | null

    if (cepInput) IMask(cepInput, { mask: '00000-000' })
    if (phoneInput) IMask(phoneInput, { mask: '(00) 00000-0000' })

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) setIsCreateModalOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isCreateModalOpen, isSaving])

  useEffect(() => {
    if (!editingUser) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isUpdating) setEditingUser(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [editingUser, isUpdating])

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const storeName = String(formData.get('storeName') ?? '').trim()
    const type = String(formData.get('type') ?? '').trim()
    const cep = String(formData.get('cep') ?? '').trim()
    const numero = String(formData.get('numero') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const phone = String(formData.get('phone') ?? '').trim()

    if (!storeName || !type || !email || !password) {
      setSaveError('Nome da loja, tipo, email e senha são obrigatórios.')
      return
    }

    setIsSaving(true)
    setSaveError('')

    try {
      const normalizedType = type === 'fornecedor' || type === 'comprador' || type === 'ambos' ? type : 'ambos'
      const payload = {
        storeName,
        type: normalizedType,
        cep: cep || null,
        numero: numero || null,
        email,
        password,
        phone: phone || null,
        telegram_chat_id: null,
        status: 'aprovado',
        origem_cadastro: 'painel',
      }

      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingUser || (typeof editingUser.id !== 'string' && typeof editingUser.id !== 'number')) return

    const formData = new FormData(event.currentTarget)
    const updates = {
      nome: String(formData.get('nome') ?? ''),
      telegram_chat_id: String(formData.get('telegram_chat_id') ?? ''),
      whatsapp_id: String(formData.get('whatsapp_id') ?? ''),
      pode_comprar: formData.get('pode_comprar') === 'true',
      pode_vender: formData.get('pode_vender') === 'true',
    }
    setIsUpdating(true)
    setUpdateError('')

    try {
      const response = await fetch('/api/admin-users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingUser.id, ...updates }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message ?? 'Não foi possível atualizar o usuário.')

      setUsers((current) => current.map((user) => String(user.id) === String(editingUser.id) ? { ...user, ...updates } : user))
      setEditingUser(null)
    } catch (reason) {
      setUpdateError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o usuário.')
    } finally {
      setIsUpdating(false)
    }
  }

  const columns = users.length ? Object.keys(users[0]) : []

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><Image alt="Enitime" className="panel-brand-logo" height={34} src="/LogoEnitime.png" width={34} /><span>Enitime <strong>Panel</strong></span></div>
        <nav aria-label="Menu principal" className="admin-nav">
          <a className="admin-nav__item admin-nav__item--active" href="#usuarios"><span aria-hidden="true">◈</span> Usuários</a>
          <a className="admin-nav__item" href="#configuracoes"><span aria-hidden="true">⚙</span> Configurações</a>
        </nav>
        <div className="admin-sidebar-footer"><span className="status-dot" /> Sessão ativa</div>
      </aside>

      <section className="admin-content" id="usuarios">
        <header className="admin-header"><div><p className="eyebrow">Gerenciamento</p><h1>Usuários</h1><p>Visualize os usuários cadastrados na sua aplicação n8n.</p></div><div className="admin-header-actions"><div className="admin-avatar" aria-label="Administrador">A</div><LogoutButton /></div></header>
        <div className="users-card">
          <div className="users-card__header"><div><h2>Todos os usuários</h2><p>{isLoading ? 'Carregando registros...' : `${users.length} registro${users.length === 1 ? '' : 's'} encontrado${users.length === 1 ? '' : 's'}`}</p></div><div className="users-card__actions"><button className="refresh-button" type="button" onClick={() => { setIsLoading(true); requestUsers().then((records) => { setUsers(records); setError('') }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Erro ao carregar usuários.')).finally(() => setIsLoading(false)) }}>Atualizar</button><button className="create-user-button" type="button" onClick={() => { setSaveError(''); setIsCreateModalOpen(true) }}><Plus aria-hidden="true" size={15} /> Cadastrar usuário</button></div></div>
          {isLoading && <div className="table-state">Carregando usuários...</div>}
          {error && <div className="table-state table-state--error" role="alert">{error}</div>}
          {!isLoading && !error && users.length === 0 && <div className="table-state">Nenhum usuário encontrado.</div>}
          {!isLoading && !error && users.length > 0 && <div className="user-record-list">{users.map((user, index) => <article className="user-record" key={String(user.id ?? index)}><header className="user-record__header"><h3>{formatValue(user.nome ?? `Registro ${index + 1}`, 'nome')}</h3><button aria-label={`Editar ${formatValue(user.nome, 'nome')}`} className="icon-action-button" disabled={typeof user.id !== 'string' && typeof user.id !== 'number'} onClick={() => { setUpdateError(''); setEditingUser(user) }} title="Editar usuário" type="button"><Pencil aria-hidden="true" size={15} /></button></header><dl className="user-record-grid">{columns.map((column) => <div className="user-record-field" key={column}><dt>{columnLabels[column] ?? column.replaceAll('_', ' ')}</dt><dd>{formatValue(user[column], column)}</dd></div>)}</dl></article>)}</div>}
        </div>
      </section>
      {isCreateModalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setIsCreateModalOpen(false) }}>
        <section aria-labelledby="create-user-title" aria-modal="true" className="create-user-modal" role="dialog">
          <header className="create-user-modal__header"><div><p className="eyebrow">Novo registro</p><h2 id="create-user-title">Cadastrar usuário</h2></div><button aria-label="Fechar" className="modal-close-button" disabled={isSaving} onClick={() => setIsCreateModalOpen(false)} type="button"><X aria-hidden="true" size={18} /></button></header>
          <form className="create-user-form" onSubmit={handleCreateUser}>
            <label className="create-user-field create-user-field--full"><span>Nome da loja <b>*</b></span><input autoFocus autoComplete="organization" name="storeName" placeholder="Nome da loja" required /></label>
            <label className="create-user-field"><span>Tipo <b>*</b></span><span className="create-user-select"><select defaultValue="ambos" name="type" required><option value="fornecedor">Fornecedor</option><option value="comprador">Comprador</option><option value="ambos">Ambos</option></select><ChevronDown aria-hidden="true" className="create-user-select__icon" size={16} /></span></label>
            <label className="create-user-field"><span>CEP da loja</span><input autoComplete="off" inputMode="numeric" name="cep" placeholder="00000-000" /></label>
            <label className="create-user-field"><span>Número do imóvel</span><input autoComplete="off" inputMode="numeric" min="0" name="numero" placeholder="Ex.: 123" step="1" type="number" /></label>
            <label className="create-user-field create-user-field--full"><span>Email <b>*</b></span><input autoComplete="email" name="email" placeholder="contato@loja.com" required type="email" /></label>
            <label className="create-user-field create-user-field--full"><span>Senha <b>*</b></span><input autoComplete="new-password" name="password" placeholder="Senha" required type="password" /></label>
            <label className="create-user-field create-user-field--full"><span>Telefone de contato</span><input autoComplete="tel" name="phone" placeholder="(00) 00000-0000" type="tel" /></label>
            {saveError && <p className="create-user-error" role="alert">{saveError}</p>}
            <footer className="create-user-modal__footer"><span className="required-note">* Obrigatório</span><div><button className="refresh-button" disabled={isSaving} onClick={() => setIsCreateModalOpen(false)} type="button">Cancelar</button><button className="create-user-button" disabled={isSaving} type="submit">{isSaving ? 'Cadastrando...' : 'Cadastrar'}</button></div></footer>
          </form>
        </section>
      </div>}
      {editingUser && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isUpdating) setEditingUser(null) }}>
        <section aria-labelledby="edit-user-title" aria-modal="true" className="create-user-modal" role="dialog">
          <header className="create-user-modal__header"><div><p className="eyebrow">Usuário</p><h2 id="edit-user-title">Editar usuário</h2></div><button aria-label="Fechar" className="modal-close-button" disabled={isUpdating} onClick={() => setEditingUser(null)} type="button"><X aria-hidden="true" size={18} /></button></header>
          <form className="create-user-form" onSubmit={handleUpdateUser}>
            <label className="create-user-field"><span>Nome <b>*</b></span><input autoFocus autoComplete="organization" defaultValue={String(editingUser.nome ?? '')} name="nome" required /></label>
            <label className="create-user-field"><span>Telegram Chat ID</span><input autoComplete="off" defaultValue={String(editingUser.telegram_chat_id ?? '')} name="telegram_chat_id" /></label>
            <label className="create-user-field"><span>WhatsApp ID</span><input autoComplete="off" defaultValue={String(editingUser.whatsapp_id ?? '')} name="whatsapp_id" /></label>
            <label className="create-user-field"><span>Pode comprar</span><span className="create-user-select"><select defaultValue={isEnabled(editingUser.pode_comprar) ? 'true' : 'false'} name="pode_comprar"><option value="true">Sim</option><option value="false">Não</option></select><ChevronDown aria-hidden="true" className="create-user-select__icon" size={16} /></span></label>
            <label className="create-user-field"><span>Pode vender</span><span className="create-user-select"><select defaultValue={isEnabled(editingUser.pode_vender) ? 'true' : 'false'} name="pode_vender"><option value="true">Sim</option><option value="false">Não</option></select><ChevronDown aria-hidden="true" className="create-user-select__icon" size={16} /></span></label>
            {updateError && <p className="create-user-error" role="alert">{updateError}</p>}
            <footer className="create-user-modal__footer"><span className="required-note">ID e privilégios administrativos não são editáveis</span><div><button className="refresh-button" disabled={isUpdating} onClick={() => setEditingUser(null)} type="button">Cancelar</button><button className="create-user-button" disabled={isUpdating} type="submit">{isUpdating ? 'Salvando...' : 'Salvar alterações'}</button></div></footer>
          </form>
        </section>
      </div>}
    </main>
  )
}
