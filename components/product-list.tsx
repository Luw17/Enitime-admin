'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Pencil, X } from 'lucide-react'
import type { ProductRecord } from '@/lib/products'
import { ModelTagsInput } from '@/components/model-tags-input'
import { parseCompatibleModels } from '@/lib/model-tags'

const labels: Record<string, string> = {
  sku: 'SKU',
  part_number: 'Código da peça',
  modelos_compativeis: 'Modelos compatíveis',
  tipo_componente: 'Tipo de componente',
  marca_qualidade: 'Marca/qualidade',
  preco: 'Preço (R$)',
  quantidade: 'Quantidade',
  estoque: 'Estoque',
}

const editableFields = ['part_number', 'modelos_compativeis', 'tipo_componente', 'marca_qualidade', 'preco', 'quantidade']

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.map(String).join(', ') || '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function ProductList({ initialProducts }: { initialProducts: ProductRecord[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const productKeys = Array.from(new Set(products.flatMap((product) => Object.keys(product))))
    .filter((key) => !['id', 'fornecedorid'].includes(key.toLowerCase().replace(/[\s_-]/g, '')))

  useEffect(() => {
    if (!editingProduct) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isUpdating) setEditingProduct(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [editingProduct, isUpdating])

  async function handleUpdateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingProduct || (typeof editingProduct.id !== 'string' && typeof editingProduct.id !== 'number')) return

    const formData = new FormData(event.currentTarget)
    const updates = {
      part_number: String(formData.get('part_number') ?? ''),
      modelos_compativeis: parseCompatibleModels(formData.get('modelos_compativeis')),
      tipo_componente: String(formData.get('tipo_componente') ?? ''),
      marca_qualidade: String(formData.get('marca_qualidade') ?? ''),
      preco: Number(formData.get('preco')),
      quantidade: Number(formData.get('quantidade')),
    }
    setIsUpdating(true)
    setUpdateError('')

    try {
      const response = await fetch('/api/painel/produtos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingProduct.id, ...updates }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message ?? 'Não foi possível atualizar o produto.')

      setProducts((current) => current.map((product) => String(product.id) === String(editingProduct.id) ? { ...product, ...updates } : product))
      setEditingProduct(null)
    } catch (reason) {
      setUpdateError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o produto.')
    } finally {
      setIsUpdating(false)
    }
  }

  if (products.length === 0) return <div className="table-state">Nenhum produto encontrado.</div>

  return <>
    <div className="products-table-wrap"><table className="products-table"><thead><tr>{productKeys.map((key) => <th key={key}>{labels[key] ?? key.replaceAll('_', ' ')}</th>)}<th>Ações</th></tr></thead><tbody>{products.map((product, index) => {
      const hasId = typeof product.id === 'string' || typeof product.id === 'number'
      return <tr key={String(product.id ?? product.sku ?? index)}>{productKeys.map((key) => <td key={key}>{displayValue(product[key])}</td>)}<td><button aria-label={`Editar produto ${displayValue(product.sku ?? product.id)}`} className="icon-action-button" disabled={!hasId} onClick={() => { setUpdateError(''); setEditingProduct(product) }} title={hasId ? 'Editar produto' : 'Produto sem ID para edição'} type="button"><Pencil aria-hidden="true" size={15} /></button></td></tr>
    })}</tbody></table></div>
    {editingProduct && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isUpdating) setEditingProduct(null) }}>
      <section aria-labelledby="edit-product-title" aria-modal="true" className="create-user-modal" role="dialog">
        <header className="create-user-modal__header"><div><p className="eyebrow">Estoque da loja</p><h2 id="edit-product-title">Editar produto</h2></div><button aria-label="Fechar" className="modal-close-button" disabled={isUpdating} onClick={() => setEditingProduct(null)} type="button"><X aria-hidden="true" size={18} /></button></header>
        <form className="create-user-form" onSubmit={handleUpdateProduct}>
          <label className="create-user-field"><span>SKU</span><input defaultValue={String(editingProduct.sku ?? '')} disabled /></label>
          <label className="create-user-field"><span>Código da peça</span><input defaultValue={String(editingProduct.part_number ?? '')} name="part_number" /></label>
          <div className="create-user-field"><span>Modelos compatíveis</span><ModelTagsInput ariaLabel="Modelos compatíveis" name="modelos_compativeis" onChange={(models) => setEditingProduct((current) => current ? { ...current, modelos_compativeis: models } : current)} value={parseCompatibleModels(editingProduct.modelos_compativeis)} /></div>
          <label className="create-user-field"><span>Tipo de componente</span><input defaultValue={String(editingProduct.tipo_componente ?? '')} name="tipo_componente" /></label>
          <label className="create-user-field"><span>Marca/qualidade</span><input defaultValue={String(editingProduct.marca_qualidade ?? '')} name="marca_qualidade" /></label>
          <label className="create-user-field"><span>Preço (R$) <b>*</b></span><input defaultValue={String(editingProduct.preco ?? '')} min="0" name="preco" required step="0.01" type="number" /></label>
          <label className="create-user-field"><span>Quantidade <b>*</b></span><input defaultValue={String(editingProduct.quantidade ?? '')} min="0" name="quantidade" required step="1" type="number" /></label>
          {updateError && <p className="create-user-error" role="alert">{updateError}</p>}
          <footer className="create-user-modal__footer"><span className="required-note">SKU e loja não são editáveis</span><div><button className="refresh-button" disabled={isUpdating} onClick={() => setEditingProduct(null)} type="button">Cancelar</button><button className="create-user-button" disabled={isUpdating} type="submit">{isUpdating ? 'Salvando...' : 'Salvar alterações'}</button></div></footer>
        </form>
      </section>
    </div>}
  </>
}