import type { Metadata } from 'next'
import GlobalToast from '@/components/global-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'TikTok漫剧管理后台',
  description: 'TikTok漫剧管理后台 · Next.js + Gin',
  generator: 'tiktok-drama-admin',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="[overscroll-behavior:none]">
      <body className="font-sans antialiased [overscroll-behavior:none]">
        {children}
        <GlobalToast />
      </body>
    </html>
  )
}
