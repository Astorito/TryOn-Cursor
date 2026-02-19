export const metadata = {
  title: 'TryOn API - Virtual Try-On Platform',
  description: 'API de virtual try-on impulsada por IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
