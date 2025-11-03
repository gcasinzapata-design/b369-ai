
import Link from 'next/link'
export default function Home(){
  return (
    <div className="space-y-8">
      <section className="brand-hero">
        <h1 className="text-3xl font-bold">Agente IA · Buscador y Tasador</h1>
        <p className="mt-2 text-gray-200 max-w-2xl">Resultados y tasaciones con comparables cercanos. Listo para publicar.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/resultados" className="btn btn-secondary">Explorar resultados</Link>
          <Link href="/tasador" className="btn btn-primary">Tasador (por ubicación)</Link>
        </div>
      </section>
      <section className="grid md:grid-cols-3 gap-4">
        <div className="stat"><b>Rápido</b><p>Unifica varias fuentes en segundos.</p></div>
        <div className="stat"><b>Transparente</b><p>Comparables, rango y precio m².</p></div>
        <div className="stat"><b>Simple</b><p>UI limpia, mobile-first.</p></div>
      </section>
    </div>
  )
}
