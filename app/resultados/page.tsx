
'use client'

import { useEffect, useState } from 'react'

type Item = {
  id: string; titulo: string; precio: number; moneda: string; m2: number; habitaciones: number;
  direccion?: string; fuente?: string; url?: string
}

function toCSV(rows: Item[]){
  const headers = ['id','titulo','precio','moneda','m2','habitaciones','fuente','url']
  const esc = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  return [headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${esc((r as any)[h])}"`).join(','))).join('\n')
}

export default function Resultados(){
  const [items, setItems] = useState<Item[]>([])
  useEffect(()=>{ fetch('/mock.json').then(r=>r.json()).then(setItems) },[])
  const exportCSV = ()=>{
    const csv = toCSV(items)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'resultados_b369.csv'; a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="card p-3 flex gap-2">
          <input className="input flex-1" placeholder="¿Qué buscas? Ej: depa miraflores 2 hab vista mar"/>
          <button className="btn btn-primary">Buscar</button>
          <button className="btn btn-secondary" onClick={exportCSV}>Exportar CSV</button>
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
                  <span className="text-sm">{it.m2} m² · {it.habitaciones} hab</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="badge">{(it.fuente||'web').toUpperCase()}</span>
                  <div className="flex gap-2">
                    {it.url && <a href={it.url} target="_blank" className="text-blue-600">Anuncio →</a>}
                    <a href={`/tasador?area_m2=${it.m2}&direccion=${encodeURIComponent(it.titulo)}`} className="text-emerald-700">Tasar →</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="card p-2 h-[520px] flex items-center justify-center text-sm text-gray-500">
        <div className="text-center">
          <div className="font-semibold">Mapa (preview)</div>
          <div>En producción: Leaflet + OSM</div>
        </div>
      </div>
    </div>
  )
}
