import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession()
  if (!session) redirect('/')
  if (!session.user.is_admin) redirect('/painel')

  return children
}