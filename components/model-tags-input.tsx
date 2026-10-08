'use client'

import { useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { parseCompatibleModels, serializeCompatibleModels } from '@/lib/model-tags'

type ModelTagsInputProps = {
  value: string[]
  onChange: (models: string[]) => void
  ariaLabel: string
  name?: string
}

export function ModelTagsInput({ value, onChange, ariaLabel, name }: ModelTagsInputProps) {
  const [draft, setDraft] = useState('')

  function addModels(models: unknown) {
    const additions = parseCompatibleModels(models)
    if (additions.length) onChange(parseCompatibleModels([...value, ...additions]))
    setDraft('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addModels(draft)
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    } else if (event.key === 'Escape') {
      setDraft('')
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text')
    if (!/[,;\n]/.test(pasted)) return
    event.preventDefault()
    addModels(pasted)
  }

  return (
    <div className="model-tags-input">
      {value.map((model) => (
        <span className="model-tags-input__tag" key={model}>
          {model}
          <button aria-label={`Remover modelo ${model}`} className="model-tags-input__remove" onClick={() => onChange(value.filter((item) => item !== model))} type="button">
            <X aria-hidden="true" size={12} />
          </button>
        </span>
      ))}
      <input aria-label={ariaLabel} onBlur={() => addModels(draft)} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder={value.length ? 'Adicionar modelo' : 'Digite modelo e pressione Enter'} type="text" value={draft} />
      {name && <input name={name} type="hidden" value={serializeCompatibleModels([...value, ...parseCompatibleModels(draft)])} />}
    </div>
  )
}