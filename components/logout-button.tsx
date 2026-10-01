'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/admin-logout', { method: 'POST' })
    router.replace('/')
    router.refresh()
  }

  return (
    <button aria-label="Sair" className="logout-button" onClick={handleLogout} title="Sair" type="button">
      <LogOut aria-hidden="true" size={15} />
      <span>Sair</span>
    </button>
  )
}