"use client"

import React, { useEffect, useRef, useState } from 'react'

type SearchResult = {
  produto_id?: string | number
  sku?: string
  part_number?: string
  modelos_compativeis?: string
  tipo_componente?: string
  marca_qualidade?: string
  preco?: string | number
  quantidade_estoque?: number | string
  nome_loja?: string
  vendedor_nome?: string
  distancia_km?: string | number
  loja_telegram_chat_id?: string | number
  loja_whatsapp_id?: string | number
  loja_telefone?: string | number
}

declare global {
  interface Window {
    Telegram?: any
  }
}

function normalizeResults(payload: unknown): SearchResult[] {
  if (Array.isArray(payload)) return payload.filter((item): item is SearchResult => item !== null && typeof item === 'object') as SearchResult[]

  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  const list = Array.isArray(record.produtos)
    ? record.produtos
    : Array.isArray(record.products)
      ? record.products
      : Array.isArray(record.data)
        ? record.data
        : []

  return list.filter((item): item is SearchResult => item !== null && typeof item === 'object') as SearchResult[]
}

export default function SearchPage() {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.Telegram && window.Telegram.WebApp) return

    const s = document.createElement('script')
    s.src = 'https://telegram.org/js/telegram-web-app.js'
    s.async = true
    s.onload = () => {
      try {
        const tg = window.Telegram?.WebApp
        if (tg && typeof tg.ready === 'function') tg.ready()
        if (tg && typeof tg.expand === 'function') tg.expand()
      } catch {}
    }
    document.head.appendChild(s)
    return () => { s.remove() }
  }, [])

  useEffect(() => {
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
    if (!tg) return

    try {
      tg.ready()
      if (tg.expand) tg.expand()
    } catch {}

    const onMain = () => formRef.current?.requestSubmit?.()

    if (tg.MainButton) {
      try {
        tg.MainButton.setText('Buscar')
        tg.MainButton.show()
        tg.onEvent && tg.onEvent('mainButtonClicked', onMain)
      } catch {}
    }

    return () => {
      try {
        if (tg && tg.onEvent) tg.onEvent('mainButtonClicked', null)
      } catch {}
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
    const telegramUser = tg?.initDataUnsafe?.user ?? null
    const telegramChat = tg?.initDataUnsafe?.chat ?? null

    const payload = {
      tipo_componente: String(formData.get('tipo_componente') ?? '').trim() || null,
      modelo_compativel: String(formData.get('modelo_compativel') ?? '').trim() || null,
      codigo_peca: String(formData.get('codigo_peca') ?? '').trim() || null,
      raio_km: String(formData.get('raio_km') ?? '').trim() || null,
      user_id: String(telegramUser?.id ?? formData.get('user_id') ?? '').trim() || null,
      telegram_user_id: telegramUser?.id ?? null,
      telegram_chat_id: telegramChat?.id ?? (String(formData.get('telegram_chat_id') ?? '').trim() || null),
      username: telegramUser?.username ?? null,
      first_name: telegramUser?.first_name ?? null,
      last_name: telegramUser?.last_name ?? null,
      initData: tg?.initData ?? null,
      initDataUnsafe: tg?.initDataUnsafe ?? null,
    }

    try {
      const response = await fetch('/api/busca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)

      if (response.ok) {
        const nextResults = normalizeResults(result)
        setResults(nextResults)
        setMessage(nextResults.length ? `Encontramos ${nextResults.length} peça${nextResults.length === 1 ? '' : 's'}.` : 'Nenhuma peça foi encontrada para esse filtro.')
        return
      }

      setResults([])
      setMessage(result?.message ?? 'Falha ao enviar a busca.')
    } catch {
      setMessage('Erro de conexão ao enviar a busca.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="search-mobile-shell">
      <section className="search-mobile-screen">
        <header className="search-mobile-header">
          <p className="eyebrow">Busca</p>
          <h1>Encontre peças</h1>
        </header>

        <form ref={formRef} onSubmit={handleSubmit} className="search-mobile-form">
          <div className="search-mobile-filters">
            <label htmlFor="tipo_componente">
              <span>Tipo</span>
              <input id="tipo_componente" name="tipo_componente" type="text" placeholder="Ex.: Tela, Bateria" />
            </label>

            <label htmlFor="modelo_compativel">
              <span>Modelo</span>
              <input id="modelo_compativel" name="modelo_compativel" type="text" placeholder="Ex.: Moto G8" />
            </label>

            <label htmlFor="codigo_peca">
              <span>Código</span>
              <input id="codigo_peca" name="codigo_peca" type="text" placeholder="Ex.: BN53" />
            </label>

            <label htmlFor="raio_km">
              <span>Raio</span>
              <input id="raio_km" name="raio_km" type="number" min="0" step="1" placeholder="20 km" />
            </label>
          </div>

          <input type="hidden" name="user_id" value="" />
          <input type="hidden" name="telegram_chat_id" value="" />

          <div className="search-mobile-actions">
            <button className="login-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Buscando...' : 'Buscar'}</button>
          </div>

          {message && <p className="form-note">{message}</p>}
        </form>

        <section className="search-mobile-results" aria-live="polite">
          <div className="search-mobile-results__header">
            <h2>Peças encontradas</h2>
            {results.length > 0 && <span>{results.length} item{results.length === 1 ? '' : 's'}</span>}
          </div>

          {!results.length ? (
            <div className="search-mobile-empty-state">
              <p>Os resultados aparecerão aqui após a busca.</p>
            </div>
          ) : (
            <div className="search-mobile-cards">
              {results.map((item, index) => (
                <article className="search-mobile-card" key={String(item.produto_id ?? item.sku ?? `${item.nome_loja ?? 'peca'}-${index}`)}>
                  <div className="search-mobile-card__topline">
                    <span className="search-mobile-card__tag">{item.tipo_componente || 'Peça'}</span>
                    <span className="search-mobile-card__distance">{item.distancia_km ? `${item.distancia_km} km` : 'Próximo'}</span>
                  </div>
                  <h3>{item.part_number || item.sku || 'Peça sem código'}</h3>
                  <p className="search-mobile-card__subline">{item.modelos_compativeis || item.nome_loja || 'Modelo não informado'}</p>
                  <div className="search-mobile-card__meta">
                    <div>
                      <span className="search-mobile-card__label">Loja</span>
                      <strong>{item.nome_loja || 'Loja'}</strong>
                    </div>
                    <div>
                      <span className="search-mobile-card__label">Preço</span>
                      <strong>{typeof item.preco === 'number' ? `R$ ${item.preco.toFixed(2).replace('.', ',')}` : item.preco ? `R$ ${String(item.preco).replace('.', ',')}` : 'Preço não informado'}</strong>
                    </div>
                  </div>
                  <div className="search-mobile-card__footer">
                    <span>{item.quantidade_estoque ?? 0} em estoque</span>
                    <button type="button" className="search-mobile-card__button">Contato</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
