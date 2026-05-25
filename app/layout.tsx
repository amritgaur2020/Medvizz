import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'MedVis AI — Medical Learning & 3D Visualization',
  description: 'An interactive clinical AI assistant and real-time 3D simulation platform for medical students and professionals.',
  generator: 'MedVis AI',
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

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider 
      appearance={{ 
        baseTheme: dark,
        variables: { 
          colorPrimary: '#ffffff', // Changed to white as per request
          colorBackground: '#0d0d0d', 
          colorInputBackground: '#1a1a1a',
          colorInputText: '#ffffff',
          colorText: '#ffffff',
          colorTextSecondary: '#ffffff',
        },
        elements: {
          card: 'bg-[#1a1a1a]/95 border border-[#2f2f2f]/80 rounded-[28px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-md',
          headerTitle: 'text-2xl font-extrabold !text-white tracking-tight',
          headerSubtitle: '!text-white',
          socialButtonsBlockButton: 'border-[#2f2f2f] hover:border-[#3f3f3f] bg-[#212121]/30 hover:bg-[#212121]/70 transition-all !text-white',
          socialButtonsBlockButtonText: '!text-white font-semibold',
          socialButtonsBlockButtonArrow: '!text-white',
          socialButtonsProviderIcon: '!text-white grayscale brightness-200 contrast-200',
          formButtonPrimary: 'bg-cyan-600 hover:bg-cyan-500 text-sm font-bold !text-white transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] border-none',
          formFieldInput: 'bg-[#111] border border-[#2f2f2f] rounded-xl px-4 py-3.5 text-sm !text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all',
          formFieldLabel: '!text-white font-semibold',
          dividerText: '!text-white',
          dividerLine: 'bg-[#2f2f2f]',
          footerActionText: '!text-white',
          footerActionLink: '!text-white hover:underline font-semibold',
          footerPagesLink: '!text-white',
          userButtonPopoverCard: 'bg-[#1a1a1a] border border-[#2f2f2f] shadow-2xl rounded-2xl',
          userButtonPopoverActionButton: 'hover:bg-[#252525] !text-white',
          userButtonPopoverActionButtonText: '!text-white',
          userButtonPopoverActionButtonIcon: '!text-white',
          userButtonPopoverFooter: '!text-white',
          badge: '!text-white',
          providerIcon: '!text-white',
        }
      }}
    >
      <html lang="en" className="dark">
        <body className="font-sans antialiased bg-background">
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </body>
      </html>
    </ClerkProvider>
  )
}
