'use client'

import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { Download, Plus, Trash2, Upload, X } from 'lucide-react'

type ProductValues = {
  sku: string
  part_number: string
  modelos_compativeis: string
  tipo_componente: string
  marca_qualidade: string
  preco: string
  quantidade: string
}

type ProductRow = ProductValues & { rowId: number }
type ProductField = keyof ProductValues

type SaveFeedback = {
  success: boolean
  saved: number | null
  updated: number | null
  failedSkus: string[]
  message: string
}

const columns: { key: ProductField; label: string; required: boolean }[] = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'part_number', label: 'Part Number', required: false },
  { key: 'modelos_compativeis', label: 'Modelos Compatíveis', required: false },
  { key: 'tipo_componente', label: 'Tipo de Componente', required: false },
  { key: 'marca_qualidade', label: 'Marca/Qualidade', required: false },
  { key: 'preco', label: 'Preço (R$)', required: true },
  { key: 'quantidade', label: 'Quantidade', required: true },
]

const fieldByHeader: Record<string, ProductField> = {
  sku: 'sku',
  partnumber: 'part_number',
  pn: 'part_number',
  modeloscompativeis: 'modelos_compativeis',
  tipodecomponente: 'tipo_componente',
  tipocomponente: 'tipo_componente',
  marcaqualidade: 'marca_qualidade',
  preco: 'preco',
  precor: 'preco',
  valor: 'preco',
  quantidade: 'quantidade',
  qtd: 'quantidade',
}

function emptyProduct(): ProductValues {
  return {
    sku: '',
    part_number: '',
    modelos_compativeis: '',
    tipo_componente: '',
    marca_qualidade: '',
    preco: '',
    quantidade: '',
  }
}

function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parsePrice(value: string): number | null {
  let normalized = value.trim().replace(/r\$/gi, '').replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  if (!normalized) return null
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.')
  else if ((normalized.match(/\./g) ?? []).length > 1) normalized = normalized.replace(/\./g, '')
  const price = Number(normalized)
  return Number.isFinite(price) && price >= 0 ? price : null
}

function parseQuantity(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = /^\d{1,3}(?:\.\d{3})+$/.test(trimmed) ? trimmed.replace(/\./g, '') : trimmed.replace(',', '.')
  const quantity = Number(normalized)
  return Number.isInteger(quantity) && quantity >= 0 ? quantity : null
}

function recordsIn(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return []
  const records: Record<string, unknown>[] = []
  const visit = (candidate: unknown, depth: number) => {
    if (depth > 3 || !candidate || typeof candidate !== 'object') return
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, depth + 1))
      return
    }
    const record = candidate as Record<string, unknown>
    records.push(record)
    for (const key of ['data', 'result', 'resultado', 'summary', 'resumo']) visit(record[key], depth + 1)
  }
  visit(value, 0)
  return records
}

function responseFeedback(value: unknown, success: boolean): SaveFeedback {
  const records = recordsIn(value)
  const numberFor = (keys: string[]) => {
    for (const record of records) {
      for (const key of keys) {
        const count = record[key]
        if (typeof count === 'number' && Number.isFinite(count)) return count
        if (typeof count === 'string' && count.trim() && Number.isFinite(Number(count))) return Number(count)
      }
    }
    return null
  }
  const failedSkus = new Set<string>()
  for (const record of records) {
    for (const key of ['failedSkus', 'failed_skus', 'skus_falha', 'falhas', 'failed', 'errors', 'erros']) {
      const failures = record[key]
      if (!Array.isArray(failures)) continue
      for (const failure of failures) {
        if (typeof failure === 'string') failedSkus.add(failure)
        else if (failure && typeof failure === 'object' && 'sku' in failure && typeof failure.sku === 'string') failedSkus.add(failure.sku)
      }
    }
  }
  const messageValue = records.map((record) => record.message ?? record.mensagem ?? record.error).find((message) => typeof message === 'string')

  return {
    success,
    saved: numberFor(['saved', 'salvos', 'created', 'inserted', 'inseridos', 'total_saved', 'totalSalvos']),
    updated: numberFor(['updated', 'atualizados', 'modified', 'total_updated', 'totalAtualizados']),
    failedSkus: Array.from(failedSkus),
    message: typeof messageValue === 'string' ? messageValue : success ? 'Operação concluída.' : 'Não foi possível salvar os produtos.',
  }
}

export function BulkProductEditor() {
  const [rows, setRows] = useState<ProductRow[]>([{ ...emptyProduct(), rowId: 1 }])
  const [csvError, setCsvError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<SaveFeedback | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const nextRowId = useRef(2)
  const fileInput = useRef<HTMLInputElement>(null)

  const skuCounts = new Map<string, number>()
  for (const row of rows) {
    const sku = row.sku.trim().toLocaleLowerCase('pt-BR')
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1)
  }

  function errorFor(row: ProductRow, field: ProductField) {
    const value = row[field].trim()
    if (field === 'sku' && value && (skuCounts.get(value.toLocaleLowerCase('pt-BR')) ?? 0) > 1) return 'SKU duplicado'
    if (['sku', 'preco', 'quantidade'].includes(field) && !value) return 'Campo obrigatório'
    if (field === 'preco' && value && parsePrice(value) === null) return 'Preço inválido'
    if (field === 'quantidade' && value && parseQuantity(value) === null) return 'Use uma quantidade inteira'
    return ''
  }

  const rowErrors = rows.flatMap((row, index) => {
    const errors = columns.flatMap(({ key, label }) => {
      const error = errorFor(row, key)
      return error ? [`Linha ${index + 1}, ${label}: ${error.toLowerCase()}.`] : []
    })
    return errors
  })
  const canSave = rows.length > 0 && rowErrors.length === 0 && !isSaving
  const mainColumns = columns.filter(({ key }) => ['sku', 'preco', 'quantidade'].includes(key))
  const optionalColumns = columns.filter(({ key }) => !['sku', 'preco', 'quantidade'].includes(key))

  function updateRow(rowId: number, field: ProductField, value: string) {
    setRows((current) => current.map((row) => row.rowId === rowId ? { ...row, [field]: value } : row))
  }

  function addRow() {
    setRows((current) => [...current, { ...emptyProduct(), rowId: nextRowId.current++ }])
  }

  async function importFile(file?: File) {
    if (!file) return
    setCsvError('')
    try {
      const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: 'greedy' })
      const parseErrors = parsed.errors.filter((error) => error.code !== 'TooManyFields')
      if (parseErrors.length) {
        setCsvError(`Não foi possível ler o CSV: ${parseErrors[0].message}`)
        return
      }
      if (!parsed.meta.fields?.length) {
        setCsvError('O CSV precisa conter a linha de cabeçalho do modelo.')
        return
      }

      const imported = parsed.data.map((record) => {
        const product = emptyProduct()
        for (const [header, value] of Object.entries(record)) {
          const field = fieldByHeader[normalizeHeader(header)]
          if (field) product[field] = typeof value === 'string' ? value.trim() : String(value ?? '')
        }
        return product
      }).filter((product) => Object.values(product).some((value) => value.trim()))

      if (!imported.length) {
        setCsvError('O arquivo não contém linhas de produtos.')
        return
      }

      setRows(imported.map((product) => ({ ...product, rowId: nextRowId.current++ })))
    } catch {
      setCsvError('Não foi possível abrir esse arquivo CSV.')
    }
  }

  function downloadTemplate() {
    const csv = Papa.unparse({ fields: columns.map(({ label }) => label), data: [] })
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'modelo-estoque.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function saveProducts() {
    if (!canSave) return
    setIsSaving(true)
    setCsvError('')
    try {
      const payload = rows.map(({ rowId: _rowId, ...row }) => ({
        ...row,
        sku: row.sku.trim(),
        part_number: row.part_number.trim(),
        modelos_compativeis: row.modelos_compativeis.trim(),
        tipo_componente: row.tipo_componente.trim(),
        marca_qualidade: row.marca_qualidade.trim(),
        preco: parsePrice(row.preco),
        quantidade: parseQuantity(row.quantidade),
      }))
      const response = await fetch('/api/painel/produtos/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.text()
      let result: unknown = body ? { message: body } : null
      try {
        if (body) result = JSON.parse(body)
      } catch {}
      if (!response.ok) {
        setFeedback(responseFeedback(result, false))
        return
      }
      setFeedback(responseFeedback(result, true))
    } catch {
      setFeedback({ success: false, saved: null, updated: null, failedSkus: [], message: 'Não foi possível conectar ao servidor.' })
    } finally {
      setIsSaving(false)
    }
  }

  function renderField(row: ProductRow, index: number, { key, label, required }: typeof columns[number]) {
    const error = errorFor(row, key)
    return <label className="spreadsheet-field" key={key}>
      <span>{label}{required && <b aria-label="obrigatório">*</b>}</span>
      <input aria-invalid={Boolean(error)} aria-label={`${label}, linha ${index + 1}`} className={error ? 'spreadsheet-cell spreadsheet-cell--invalid' : 'spreadsheet-cell'} inputMode={key === 'preco' || key === 'quantidade' ? 'decimal' : undefined} onChange={(event) => updateRow(row.rowId, key, event.target.value)} placeholder={key === 'preco' ? '0,00' : ''} title={error || label} value={row[key]} />
      <small aria-hidden={!error}>{error}</small>
    </label>
  }

  return (
    <>
      <section aria-label="Ações de estoque" className="bulk-toolbar">
        <div className="bulk-toolbar__actions">
          <button className="refresh-button" onClick={downloadTemplate} type="button"><Download aria-hidden="true" size={15} /> Baixar Planilha Modelo (.csv)</button>
          <button className="create-user-button" onClick={addRow} type="button"><Plus aria-hidden="true" size={15} /> Adicionar Linha</button>
        </div>
        <input accept=".csv,text/csv" className="csv-file-input" onChange={(event) => { importFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} ref={fileInput} type="file" />
        <button className={`csv-upload-zone${isDragging ? ' csv-upload-zone--active' : ''}`} onClick={() => fileInput.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={(event) => { event.preventDefault(); setIsDragging(false) }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setIsDragging(false); importFile(event.dataTransfer.files[0]) }} type="button">
          <Upload aria-hidden="true" size={18} />
          <span><strong>Importar CSV</strong><small>Solte o arquivo aqui ou selecione um</small></span>
        </button>
      </section>

      {csvError && <p className="bulk-error" role="alert">{csvError}</p>}

      <section aria-label="Planilha de produtos" className="spreadsheet-section">
        <div className="spreadsheet-cards">{rows.map((row, index) => <article aria-label={`Produto ${index + 1}`} className="spreadsheet-row-card" key={row.rowId}>
          <header className="spreadsheet-row-card__header"><span>Produto {index + 1}</span><button aria-label={`Excluir linha ${index + 1}`} className="spreadsheet-delete" onClick={() => setRows((current) => current.filter((item) => item.rowId !== row.rowId))} title="Excluir linha" type="button"><Trash2 aria-hidden="true" size={16} /></button></header>
          <div className="spreadsheet-required-fields">{mainColumns.map((column) => renderField(row, index, column))}</div>
          <div className="spreadsheet-optional-fields">{optionalColumns.map((column) => renderField(row, index, column))}</div>
        </article>)}</div>
        <footer className="spreadsheet-footer"><span>{rows.length} linha{rows.length === 1 ? '' : 's'}</span><span>{rowErrors.length ? `${rowErrors.length} inconsistência${rowErrors.length === 1 ? '' : 's'}` : 'Dados válidos'}</span></footer>
      </section>

      {rowErrors.length > 0 && <ul aria-label="Inconsistências da planilha" className="spreadsheet-errors" role="alert">{rowErrors.slice(0, 6).map((error) => <li key={error}>{error}</li>)}{rowErrors.length > 6 && <li>e mais {rowErrors.length - 6} inconsistência(s).</li>}</ul>}

      <footer className="bulk-submit-bar"><span>Campos com * são obrigatórios. SKUs devem ser únicos nesta lista.</span><button className="create-user-button" disabled={!canSave} onClick={saveProducts} type="button">{isSaving ? 'Salvando...' : 'Salvar Estoque'}</button></footer>

      {feedback && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFeedback(null) }}>
        <section aria-labelledby="bulk-result-title" aria-modal="true" className="bulk-result-modal" role="dialog">
          <header className="bulk-result-modal__header"><div><p className="eyebrow">Resultado do envio</p><h2 id="bulk-result-title">{feedback.success ? 'Estoque processado' : 'Não foi possível salvar'}</h2></div><button aria-label="Fechar" className="modal-close-button" onClick={() => setFeedback(null)} type="button"><X aria-hidden="true" size={18} /></button></header>
          <div className="bulk-result-content">
            <p>{feedback.message}</p>
            {(feedback.saved !== null || feedback.updated !== null) && <dl className="bulk-result-counts">{feedback.saved !== null && <div><dt>Salvos</dt><dd>{feedback.saved}</dd></div>}{feedback.updated !== null && <div><dt>Atualizados</dt><dd>{feedback.updated}</dd></div>}</dl>}
            {feedback.failedSkus.length > 0 && <div className="bulk-failed-skus"><h3>SKUs com falha</h3><ul>{feedback.failedSkus.map((sku) => <li key={sku}>{sku}</li>)}</ul></div>}
          </div>
          <footer className="bulk-result-modal__footer"><button className="create-user-button" onClick={() => setFeedback(null)} type="button">Fechar</button></footer>
        </section>
      </div>}
    </>
  )
}