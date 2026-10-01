'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export function AdminLogin() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    const formData = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
        }),
      })

      const result = await response.json().catch(() => null)
      if (response.ok) {
        router.push(result?.user?.is_admin === true ? '/admin' : '/painel')
        return
      }

      setErrorMessage(result?.message ?? 'Usuário ou senha inválidos.')
    } catch {
      setErrorMessage('Não foi possível conectar ao servidor de autenticação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <div className="login-glow login-glow--one" />
      <div className="login-glow login-glow--two" />

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <Image alt="Enitime" className="panel-brand-logo panel-brand-logo--login" height={42} src="/LogoEnitime.png" width={42} />
          <span>Enitime <strong>Panel</strong></span>
        </div>

        <div className="login-heading">
          <p className="eyebrow">Área restrita</p>
          <h1 id="login-title">Bem-vindo de volta</h1>
          <p>Entre com suas credenciais para abrir seu painel.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="username">Usuário</label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">@</span>
            <input id="username" name="username" type="text" placeholder="Digite seu usuário" autoComplete="username" required />
          </div>

          <div className="field-row">
            <label className="field-label" htmlFor="password">Senha</label>
            <button className="forgot-link" type="button">Esqueceu a senha?</button>
          </div>
          <div className="input-wrap">
            <span className="input-icon input-icon--lock" aria-hidden="true">⌑</span>
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha" autoComplete="current-password" required />
            <button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {errorMessage && <p className="form-note form-note--error" role="alert">{errorMessage}</p>}
          <button className="login-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Validando acesso...' : 'Entrar no painel'} <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="security-note">
          <span aria-hidden="true" className="security-icon">✓</span>
          <span>Conexão protegida para sua conta.</span>
        </div>
      </section>

      <footer className="login-footer">
        <span>Enitime Panel</span>
        <span className="footer-dot" aria-hidden="true" />
        <span>v1.0.0</span>
      </footer>
    </main>
  )
}
