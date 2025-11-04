'use client'

import { useEffect, useMemo, useState } from 'react'
import ChatSearch from '@/components/ChatSearch'

type Item = {
  id: string; titulo: string; precio: number; moneda: string; m2: number; habitaciones: number;
  banos?: number; estacionamientos?: number; direccion?: string; fuente?: string; url?: string
}

function toCSV(rows: Item[]){
  const headers = ['id','titulo','precio','moneda','m2','habitaciones','banos','estacionamientos','fuente','url']
  const esc = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  return [headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${esc((r as any)[h])}"`).join(','))).join('\n')
}

export default function Resultados(){
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)

  // Filtros del panel derecho (opcionales)
  const [filters, setFilters] = useState({
    tipo: '' as ''|'casa'|'departamento',
    min_m2: '' as number | '' ,
    max_m2: '' as number | '' ,
    habitaciones: '' as number | '' ,
    banos: '' as number | '' ,
  })

  const search = async (q: string) => {
    setBusy(true)
    const res = await fetch('/api/search', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        q,
        filters: {
          ...filters,
          // normalizar vacíos a undefined
          min_m2: filters.min_m2 || undefined,
          max_m2: filters.max_m2 || undefined,
          habitaciones: filters.habitaciones || undefined,
          banos: filters.banos || undefined,
          tipo: filters.tipo || undefined
        }
      })
    })
    const json = await res.json()
    setItems(json.items || [])
    setBusy(false)
  }

  // Búsqueda inicial de cortesía (para que no quede vacío)
  useEffect(()=>{ search('departamento miraflores 2 hab máx $250000') },[]) // eslint-disable-line

  const exportCSV = ()=>{
    const csv = toCSV(items)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'resultados_b369.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const total = useMemo(()=> items.length, [items])

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* IZQUIERDA: Chat IA */}
      <div className="md:col-span-1">
        <ChatSearch onSubmit={search} busy={busy}/>
      </div>

      {/* DERECHA: Filtros + resultados */}
      <div className="md:col-span-2 space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Filtros avanzados</h2>
            <div className="text-sm text-gray-600">Resultados: <b>{total}</b></div>
          </div>
          <div className="grid sm:grid-cols-5 gap-3 mt-3">
            <label className="label">Tipo
              <select className="input" value={filters.tipo}
                      onChange={e=>setFilters({...filters, tipo: e.target.value as any})}>
                <option value="">(Todos)</option>
                <option value="departamento">Departamento</option>
                <option value="casa">Casa</option>
              </select>
            </label>
            <label className="label">Min m²
              <input className="input" type="number" value={String(filters.min_m2)}
                     onChange={e=>setFilters({...filters, min_m2: e.target.value? Number(e.target.value): ''})}/>
            </label>
            <label className="label">Max m²
              <input className="input" type="number" value={String(filters.max_m2)}
                     onChange={e=>setFilters({...filters, max_m2: e.target.value? Number(e.target.value): ''})}/>
            </label>
            <label className="label">Habitaciones
              <input className="input" type="number" value={String(filters.habitaciones)}
                     onChange={e=>setFilters({...filters, habitaciones: e.target.value? Number(e.target.value): ''})}/>
            </label>
            <label className="label">Baños
              <input className="input" type="number" value={String(filters.banos)}
                     onChange={e=>setFilters({...filters, banos: e.target.value? Number(e.target.value): ''})}/>
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={()=>search('')}>
              {busy ? 'Aplicando…' : 'Aplicar filtros'}
            </button>
            <button className="btn btn-secondary" onClick={exportCSV}>Exportar CSV</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((it)=>(
            <article key={it.id} className="card overflow-hidden">
              <div className="p-3 space-y-2">
                <div>
                  <h3 className="font-semibold">{it.titulo}</h3>
                  <p className="text-sm text-gray-600">{it.direccion}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{it.moneda==='USD'?'$':'S/ '}{it.precio.toLocaleString()}</span>
                  <span className="text-sm">{it.m2} m² · {it.habitaciones} hab{typeof it.banos==='number' ? ` · ${it.banos} baños` : ''}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="badge">{(it.fuente||'web').toUpperCase()}</span>
                  <div className="flex gap-3">
                    {it.url && <a href={it.url} target="_blank" className="text-blue-600">Anuncio →</a>}
                    <a href={`/tasador?area_m2=${it.m2}&habitaciones=${it.habitaciones}&direccion=${encodeURIComponent(it.titulo)}`} className="text-emerald-700">Tasar →</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {items.length===0 && (
            <div className="p-10 text-center text-sm text-gray-500 border rounded-xl">
              No hay resultados con estos criterios. Ajusta la consulta o filtros.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
