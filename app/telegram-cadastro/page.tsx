"use client"

import React, { useEffect, useRef, useState } from 'react'
import IMask from 'imask'
import { useRouter } from 'next/navigation'

declare global {
  interface Window {
    Telegram?: any
  }
}

export default function TelegramCadastroPage() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
      } catch (e) {}
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
        tg.MainButton.setText('Enviar')
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

  useEffect(() => {
    // apply masks after mount
    const cepInput = document.querySelector('input[name="cep"]') as HTMLInputElement | null
    const phoneInput = document.querySelector('input[name="phone"]') as HTMLInputElement | null
    if (cepInput) {
      IMask(cepInput, { mask: '00000-000' })
    }
    if (phoneInput) {
      IMask(phoneInput, { mask: '(00) 00000-0000' })
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const payload = {
      storeName: fd.get('storeName'),
      type: fd.get('type'),
      cep: fd.get('cep'),
      numero: fd.get('numero'),
      email: fd.get('email'),
      password: fd.get('password'),
      phone: fd.get('phone'),
      initData: typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe ?? null : null,
    }

    try {
      const res = await fetch('/api/telegram-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => null)

      if (res.ok) {
        setMessage('Cadastro enviado com sucesso.')
        if (typeof window !== 'undefined' && window.Telegram?.WebApp?.sendData) {
          try {
            window.Telegram.WebApp.sendData(JSON.stringify({ type: 'telegram_register', payload }))
          } catch {}
          try {
            window.Telegram.WebApp.close()
          } catch {}
        } else {
          router.push('/')
        }
        return
      }

      setMessage(result?.message ?? 'Falha ao enviar o cadastro.')
    } catch (err) {
      setMessage('Erro de conexão ao enviar o cadastro.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="telegram-form-shell">
      <section className="telegram-form-panel">
        <h1>Cadastro de loja (Telegram)</h1>

        <form ref={formRef} onSubmit={handleSubmit} className="telegram-signup-form">
          <label htmlFor="storeName">
            Nome da loja
            <input id="storeName" name="storeName" type="text" placeholder="Nome da loja" required />
          </label>

          <label htmlFor="type">
            Tipo
            <select id="type" name="type" defaultValue="ambos" required>
              <option value="fornecedor">Fornecedor</option>
              <option value="comprador">Comprador</option>
              <option value="ambos">Ambos</option>
            </select>
          </label>

          <label htmlFor="cep">
            CEP da loja
            <input id="cep" name="cep" type="text" inputMode="numeric" placeholder="00000-000" />
          </label>

          <label htmlFor="numero">
            Número
            <input id="numero" name="numero" type="text" placeholder="Número" />
          </label>

          <label htmlFor="email">
            Email
            <input id="email" name="email" type="email" placeholder="contato@loja.com" required />
          </label>

          <label htmlFor="password">
            Senha
            <input id="password" name="password" type="password" placeholder="Senha" required />
          </label>

          <label htmlFor="phone">
            Telefone de contato
            <input id="phone" name="phone" type="tel" placeholder="(00) 00000-0000" />
          </label>

          <div className="actions">
            <button className="login-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Enviando...' : 'Enviar'}</button>
          </div>

          {message && <p className="form-note">{message}</p>}
        </form>
      </section>
    </main>
  )
}
