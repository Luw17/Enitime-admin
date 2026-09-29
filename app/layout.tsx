import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'n8n Admin — Acesso restrito',
  description: 'Painel administrativo seguro para sua aplicação n8n.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="light">
      <body className="antialiased light">
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            document.body.classList.remove('dark');
            document.body.classList.add('light');
            // enforce core CSS variables in case of higher-specificity rules
            const root = document.documentElement;
            root.style.setProperty('--background', '#FFFFFF');
            root.style.setProperty('--foreground', '#0C1618');
            root.style.setProperty('--card', '#FFFFFF');
            root.style.setProperty('--accent', '#A5CAFF');
            root.style.setProperty('--border', 'rgba(12,22,24,0.08)');
            root.style.setProperty('--input', '#FFFFFF');
          } catch(e){}
        ` }} />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
