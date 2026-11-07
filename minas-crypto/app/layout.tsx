import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'CAVA Idle Mine · DEMO',
  description:
    'Minas Crypto DEMO — idle mining freemium para Andres Medina. Sin crypto real · pagos USDT vía NOWPayments.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
