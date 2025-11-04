'use client'

import { useState } from 'react'

type Props = {
  onSubmit: (q: string) => void
  busy?: boolean
}

export default function ChatSearch({ onSubmit, busy }: Props) {
  const [q,setQ] = useState('Quiero un depa en Miraflores con 2 hab, máximo $200000')

  const send = (e?: React.FormEvent) => {
    e?.preventDefault()
    onSubmit(q)
  }

  return (
    <div className="card p-4 flex flex-col h-full">
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Bot de Búsqueda (IA)</h2>
        <p className="text-xs text-gray-600">Escribe en lenguaje natural y te devolvemos resultados.</p>
      </div>

      <div className="flex-1 overflow-auto space-y-3 text-sm text-gray-700">
        <div className="bg-gray-50 rounded-xl p-3 border">
          Ejemplos:
          <ul className="list-disc ml-5 mt-1">
            <li>“Departamento en San Isidro de 3 habitaciones, máx $300,000”</li>
            <li>“Casa en Surco con jardín, 4 hab, 3 baños, máx $450,000”</li>
            <li>“Depa en Barranco cerca al malecón, 2 baños, máx $220,000”</li>
          </ul>
        </div>
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="¿Qué estás buscando?"
        />
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
    </div>
  )
}
