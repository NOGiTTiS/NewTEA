import type { Metadata } from 'next'
import { Prompt, Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { DynamicBranding } from '@/components/dynamic-branding'
import { Toaster } from 'sonner'

const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin', 'thai'],
  variable: '--font-prompt',
  display: 'swap'
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'NewTEA - Triam Evaluation and Assessment',
  description: 'ระบบบันทึกผลการเรียนประจำรายวิชา โรงเรียนเตรียมอุดมศึกษาภาคเหนือ'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning className={`${prompt.variable} ${inter.variable}`}>
      <body className="antialiased min-h-screen bg-background text-foreground transition-colors">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DynamicBranding />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
