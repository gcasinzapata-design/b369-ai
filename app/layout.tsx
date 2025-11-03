
import './globals.css'
import Image from 'next/image'
import Link from 'next/link'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="border-b bg-white">
          <div className="container py-3 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="B369" width={36} height={36} className="rounded-md" />
              <span className="font-semibold tracking-wide">B369 · Marketing Inmobiliario</span>
            </Link>
            <nav className="ml-auto text-sm flex gap-4">
              <Link href="/">Inicio</Link>
              <Link href="/resultados">Resultados</Link>
              <Link href="/tasador">Tasador</Link>
              <Link href="/mapa">Mapa</Link>
              <Link href="/contacto">Contacto</Link>
              <Link href="/admin" className="text-blue-600">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
        <footer className="border-t">
          <div className="container py-8 text-xs text-gray-600 flex items-center justify-between">
            <span>© {new Date().getFullYear()} B369</span>
            <span>Estimaciones orientativas basadas en comparables online.</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
