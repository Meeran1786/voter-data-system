import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import MdisFooter from '@/components/MdisFooter'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Voter Data System — Indian Electoral Roll Manager',
  description: 'Search, filter, and export Indian voter roll data across CSV, Excel, DOCX, PDF, and scanned images.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} antialiased bg-slate-50 flex flex-col min-h-screen`}>
        <div className="flex-1">
          {children}
        </div>
        <MdisFooter />
      </body>
    </html>
  )
}
