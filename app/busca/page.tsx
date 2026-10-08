"use client"

import React, { useEffect, useRef, useState } from 'react'
import { ShoppingCart } from 'lucide-react'

type SearchResult = {
  produto_id?: string | number
  sku?: string
  part_number?: string
  modelos_compativeis?: string | string[]
  tipo_componente?: string
  marca_qualidade?: string
  preco?: string | number
  quantidade_estoque?: number | string
  estoque_maximo?: number | string
  nome_loja?: string
  vendedor_nome?: string
  distancia_km?: string | number
  loja_telegram_chat_id?: string | number
  loja_whatsapp_id?: string | number
  loja_telefone?: string | number
}

type CartItem = SearchResult & {
  quantidade: number
  observacao: string | null
  estoque_maximo: number
}

type StoreGroup = {
  loja: string
  items: CartItem[]
  subtotal: number
}

const CART_KEY = 'enitime-cart-v1'

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

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function parsePrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const sanitized = value.trim().replace(/[^\d,.-]/g, '')
    if (!/\d/.test(sanitized)) return 0

    const commaIndex = sanitized.lastIndexOf(',')
    const dotIndex = sanitized.lastIndexOf('.')
    let normalized = sanitized

    if (commaIndex >= 0 && dotIndex >= 0) {
      const decimalIndex = Math.max(commaIndex, dotIndex)
      const integer = sanitized.slice(0, decimalIndex).replace(/[,.]/g, '')
      const fraction = sanitized.slice(decimalIndex + 1).replace(/[,.]/g, '')
      normalized = `${integer}.${fraction}`
    } else if (commaIndex >= 0) {
      const integer = sanitized.slice(0, commaIndex).replace(/[,.]/g, '')
      const fraction = sanitized.slice(commaIndex + 1).replace(/[,.]/g, '')
      normalized = `${integer}.${fraction}`
    } else if (dotIndex >= 0 && sanitized.indexOf('.') !== dotIndex) {
      const fractionDigits = sanitized.length - dotIndex - 1
      normalized = fractionDigits > 0 && fractionDigits <= 2
        ? `${sanitized.slice(0, dotIndex).replace(/\./g, '')}.${sanitized.slice(dotIndex + 1)}`
        : sanitized.replace(/\./g, '')
    }

    const numeric = Number(normalized)
    if (Number.isFinite(numeric)) return numeric
  }
  return 0
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function compatibleModels(value: SearchResult['modelos_compativeis'], fallback?: string) {
  if (Array.isArray(value)) {
    const models = value.filter((model) => typeof model === 'string').map((model) => model.trim()).filter(Boolean)
    if (models.length) return models.join(', ')
  } else if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  return fallback || 'Modelo não informado'
}

export default function SearchPage() {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null)
  const [generalObservation, setGeneralObservation] = useState('')
  const [telegramChatId, setTelegramChatId] = useState<number | string | null>(null)
  const [telegramUserId, setTelegramUserId] = useState<number | string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const cartCount = cart.reduce((total, item) => total + item.quantidade, 0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(CART_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setCart(parsed)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncTelegramContext = () => {
      const tg = window.Telegram?.WebApp
      const user = tg?.initDataUnsafe?.user
      setTelegramUserId(user?.id ?? null)
      setTelegramChatId(tg?.initDataUnsafe?.chat?.id ?? user?.id ?? null)
    }

    syncTelegramContext()
    if (window.Telegram?.WebApp) return

    const s = document.createElement('script')
    s.src = 'https://telegram.org/js/telegram-web-app.js'
    s.async = true
    s.onload = () => {
      try {
        const tg = window.Telegram?.WebApp
        if (tg && typeof tg.ready === 'function') tg.ready()
        if (tg && typeof tg.expand === 'function') tg.expand()
        syncTelegramContext()
      } catch {}
    }
    document.head.appendChild(s)
    return () => { s.remove() }
  }, [])

  useEffect(() => {
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
    setTelegramUserId(tg?.initDataUnsafe?.user?.id ?? null)
    setTelegramChatId(tg?.initDataUnsafe?.chat?.id ?? tg?.initDataUnsafe?.user?.id ?? null)

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

  const groupedCart = cart.reduce<Record<string, StoreGroup>>((accumulator, item) => {
    const loja = item.nome_loja || 'Loja'
    const store = accumulator[loja] ?? { loja, items: [], subtotal: 0 }
    store.items.push(item)
    store.subtotal += parsePrice(item.preco) * item.quantidade
    accumulator[loja] = store
    return accumulator
  }, {})

  const cartTotal = Object.values(groupedCart).reduce((total, store) => total + store.subtotal, 0)

  function addToCart(product: SearchResult) {
    const productId = Number(product.produto_id)
    if (!productId) return

    const estoqueMax = Math.max(0, toNumber(product.quantidade_estoque ?? product['estoque_maximo'] ?? 0, 0))

    setCart((current) => {
      const existing = current.find((item) => Number(item.produto_id) === productId)

      if (existing) {
        const nextQuantity = existing.quantidade + 1
        if (estoqueMax > 0 && nextQuantity > estoqueMax) {
          setMessage(`Estoque máximo atingido para ${product.part_number || product.sku || 'este item'}.`)
          return current
        }

        return current.map((item) => Number(item.produto_id) === productId ? { ...item, quantidade: nextQuantity } : item)
      }

      return [
        ...current,
        {
          ...product,
          quantidade: 1,
          observacao: null,
          estoque_maximo: estoqueMax,
        },
      ]
    })

    setSelectedProduct(product)
    setIsAddModalOpen(true)
  }

  function updateCartQuantity(productId: number | string, delta: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (Number(item.produto_id) !== Number(productId)) return item

          const nextQuantity = item.quantidade + delta
          const maxStock = item.estoque_maximo || item.quantidade

          if (delta > 0 && maxStock > 0 && nextQuantity > maxStock) return item
          if (nextQuantity <= 0) return null
          return { ...item, quantidade: nextQuantity }
        })
        .filter((item): item is CartItem => item !== null)
    )
  }

  function removeFromCart(productId: number | string) {
    setCart((current) => current.filter((item) => Number(item.produto_id) !== Number(productId)))
  }

  function changeCartObservation(productId: number | string, value: string) {
    setCart((current) =>
      current.map((item) => (Number(item.produto_id) === Number(productId) ? { ...item, observacao: value || null } : item))
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
    const telegramUser = tg?.initDataUnsafe?.user ?? null
    if (telegramUser?.id === null || telegramUser?.id === undefined) {
      setResults([])
      setMessage('Abra a busca pelo Telegram para consultar com sua conta real.')
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    setSuccessMessage(null)

    const formData = new FormData(event.currentTarget)
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

  async function handleCheckout() {
    if (!cart.length) {
      setMessage('Seu carrinho está vazio.')
      return
    }

    const payload = {
      telegram_chat_id: String(telegramChatId ?? telegramUserId ?? '').trim() || null,
      observacao_geral: generalObservation.trim() || null,
      itens: cart.map((item) => ({
        produto_id: Number(item.produto_id),
        quantidade: Number(item.quantidade),
        observacao: item.observacao || null,
      })),
    }

    try {
      const response = await fetch('/api/checkout-carrinho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage(result?.message ?? 'Não foi possível finalizar o pedido.')
        return
      }

      setCart([])
      setGeneralObservation('')
      setIsCartOpen(false)
      setSuccessMessage(result?.message ?? 'Pedido enviado com sucesso!')
      setMessage(result?.message ?? 'Pedido enviado com sucesso!')
    } catch {
      setMessage('Erro ao enviar o pedido.')
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
            <div className="search-mobile-results__actions">
              {results.length > 0 && <span>{results.length} item{results.length === 1 ? '' : 's'}</span>}
              <button aria-label={`Abrir carrinho, ${cartCount} itens`} className="search-mobile-cart-button" onClick={() => setIsCartOpen(true)} type="button">
                <ShoppingCart aria-hidden="true" size={16} />
                <span>Carrinho</span>
                <span className="search-mobile-cart-button__count">{cartCount}</span>
              </button>
            </div>
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
                  <p className="search-mobile-card__subline">{compatibleModels(item.modelos_compativeis, item.nome_loja)}</p>
                  <div className="search-mobile-card__meta">
                    <div>
                      <span className="search-mobile-card__label">Loja</span>
                      <strong>{item.nome_loja || 'Loja'}</strong>
                    </div>
                    <div>
                      <span className="search-mobile-card__label">Preço</span>
                      <strong>{typeof item.preco === 'number' ? money(item.preco) : item.preco ? money(parsePrice(item.preco)) : 'Preço não informado'}</strong>
                    </div>
                  </div>
                  <div className="search-mobile-card__footer">
                    <span>{item.quantidade_estoque ?? 0} em estoque</span>
                    <button type="button" className="search-mobile-card__button" onClick={() => addToCart(item)}>Adicionar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {isAddModalOpen && selectedProduct && (
        <div className="mobile-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="mobile-modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>Produto adicionado</h3>
            <p>{selectedProduct.part_number || selectedProduct.sku || 'Item'} foi adicionado ao carrinho.</p>
            <div className="mobile-modal-actions">
              <button className="secondary-button" type="button" onClick={() => setIsAddModalOpen(false)}>Continuar Comprando</button>
              <button className="primary-button" type="button" onClick={() => { setIsAddModalOpen(false); setIsCartOpen(true) }}>Ir para o Carrinho</button>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="mobile-cart-backdrop" onClick={() => setIsCartOpen(false)}>
          <aside className="mobile-cart-drawer" onClick={(event) => event.stopPropagation()}>
            <header className="mobile-cart-header">
              <div>
                <p className="eyebrow">Carrinho</p>
                <h2>Seu pedido</h2>
              </div>
              <button type="button" className="icon-close" onClick={() => setIsCartOpen(false)}>×</button>
            </header>

            <div className="mobile-cart-body">
              <label className="mobile-cart-observation">
                <span>Observação geral</span>
                <textarea value={generalObservation} onChange={(event) => setGeneralObservation(event.target.value)} placeholder="Ex.: Cor preta, urgente, etc." rows={3} />
              </label>

              {!cart.length ? (
                <div className="search-mobile-empty-state">
                  <p>Seu carrinho está vazio.</p>
                </div>
              ) : (
                <div className="mobile-cart-store-list">
                  {Object.values(groupedCart).map((store) => (
                    <section key={store.loja} className="mobile-cart-store">
                      <header>
                        <h3>{store.loja}</h3>
                        <strong>{money(store.subtotal)}</strong>
                      </header>

                      {store.items.map((item) => (
                        <article key={String(item.produto_id)} className="mobile-cart-item">
                          <div className="mobile-cart-item__header">
                            <div>
                              <h4>{item.part_number || item.sku || 'Peça'}</h4>
                              <p>{item.modelos_compativeis || item.tipo_componente || 'Modelo não informado'}</p>
                            </div>
                            <button type="button" className="text-button" onClick={() => removeFromCart(item.produto_id ?? 0)}>Remover</button>
                          </div>

                          <div className="mobile-cart-item__controls">
                            <button type="button" onClick={() => updateCartQuantity(item.produto_id ?? 0, -1)}>-</button>
                            <span>{item.quantidade}</span>
                            <button type="button" onClick={() => updateCartQuantity(item.produto_id ?? 0, 1)}>+</button>
                          </div>

                          <label className="mobile-cart-item__observation">
                            <span>Obs. do item</span>
                            <input value={item.observacao ?? ''} onChange={(event) => changeCartObservation(item.produto_id ?? 0, event.target.value)} placeholder="Ex.: Cor preta" />
                          </label>

                          <div className="mobile-cart-item__price">
                            <span>Preço unit.</span>
                            <strong>{money(parsePrice(item.preco))}</strong>
                          </div>
                        </article>
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </div>

            <footer className="mobile-cart-footer">
              <div className="mobile-cart-total">
                <span>Total</span>
                <strong>{money(cartTotal)}</strong>
              </div>
              <button className="primary-button primary-button--full" type="button" onClick={handleCheckout} disabled={!cart.length}>Finalizar Pedido</button>
            </footer>
          </aside>
        </div>
      )}

      {successMessage && (
        <div className="mobile-success-banner">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}
    </main>
  )
}
