import "./globals.css"
import { I18nProvider } from "@/lib/i18n/I18nProvider"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>Mini Drama</title>
      </head>
      <body className="bg-black text-white antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  )
}
