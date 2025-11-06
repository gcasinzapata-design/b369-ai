'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

type Item = {
  id: string; titulo?: string; precio?: number; moneda?: string; m2?: number;
  habitaciones?: number; banos?: number; estacionamientos?: number;
  direccion?: string; distrito?: string; fuente?: string; url?: string;
  lat?: number; lon?: number;
}

const MapClient = dynamic(()=>import('../components/MapClient'), { ssr:false })

function toCSV(rows: Item[]){
  const headers = ['id','titulo','precio','moneda','m2','habitaciones','banos','estacionamientos','direccion','distrito','fuente','url','lat','lon']
  const esc = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  return [headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${esc((r as any)[h])}"`).join(','))).join('\n')
}

export default function Resultados(){
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // filtros obligatorios
  const [distrito, setDistrito] = useState('')
  const [precioMax, setPrecioMax] = useState<number|''>('')
  const [areaMin, setAreaMin] = useState<number|''>('')
  const [habMin, setHabMin] = useState<number|''>('')

  const buscar = async ()=>{
    setError(null)
    if (!distrito || !precioMax || !areaMin) {
      setError('Completa: Distrito, Precio máximo y Área mínima.')
      return
    }
    setLoading(true)
    try{
      const res = await fetch('/api/search', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          q: '',
          filtros: {
            distrito: distrito.toLowerCase(),
            precio_max: Number(precioMax),
            area_min: Number(areaMin),
            habitaciones_min: habMin ? Number(habMin) : undefined
          }
        })
      })
      if(!res.ok) throw new Error(`/api/search ${res.status}`)
      const data = await res.json()
      if(!data.ok) throw new Error(data.error || 'error')
      setItems(data.items||[])
    }catch(e:any){
      setError(e?.message || 'Fallo la búsqueda'); setItems([])
    }finally{
      setLoading(false)
    }
  }

  const exportCSV = ()=>{
    const csv = toCSV(items)
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'resultados_b369.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid md:grid-cols-[1fr,420px] gap-6">
      <div className="space-y-3">
        <div className="card p-3 grid grid-cols-4 gap-3">
          <label className="label col-span-2">Distrito
            <input className="input" placeholder="miraflores / san isidro" value={distrito} onChange={e=>setDistrito(e.target.value)} />
          </label>
          <label className="label">Precio máx (USD)
            <input className="input" type="number" value={precioMax} onChange={e=>setPrecioMax(e.target.value?Number(e.target.value):'')} />
          </label>
          <label className="label">Área mínima (m²)
            <input className="input" type="number" value={areaMin} onChange={e=>setAreaMin(e.target.value?Number(e.target.value):'')} />
          </label>
          <label className="label">Habitaciones mín
            <input className="input" type="number" value={habMin} onChange={e=>setHabMin(e.target.value?Number(e.target.value):'')} />
          </label>
          <div className="col-span-3 flex items-end gap-2">
            <button className="btn btn-primary" onClick={buscar} disabled={loading}>{loading?'Buscando…':'Buscar'}</button>
            <button className="btn btn-secondary" onClick={exportCSV} disabled={!items.length}>Exportar CSV</button>
          </div>
          {error && <div className="col-span-4 text-sm text-red-600">{error}</div>}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((it)=>(
            <article key={it.id} className="card overflow-hidden">
              <div className="p-3 space-y-2">
                <div>
                  <h3 className="font-semibold">{it.titulo || 'Propiedad'}</h3>
                  <p className="text-sm text-gray-600">{(it.direccion||'') + (it.distrito? `, ${it.distrito}`:'')}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">
                    {it.moneda==='USD'?'$':'S/ '}{it.precio?.toLocaleString?.() || '-'}
                  </span>
                  <span className="text-sm">{it.m2? `${it.m2} m²`:'-'} · {(it.habitaciones ?? '-') } hab</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="badge">{(it.fuente||'web').toUpperCase()}</span>
                  <div className="flex gap-2">
                    {it.url && <a href={it.url} target="_blank" className="text-blue-600">Anuncio →</a>}
                    {it.m2 && <a href={`/tasador?area_m2=${it.m2}&direccion=${encodeURIComponent(it.direccion || it.titulo || '')}&distrito=${encodeURIComponent(it.distrito||'')}`} className="text-emerald-700">Tasar →</a>}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!loading && !error && !items.length && <div className="text-sm text-gray-500">Sin resultados aún. Completa filtros y busca.</div>}
        </div>
      </div>

      <div className="card p-2 h-[560px]">
        <MapClient pins={(items||[]).filter(i=>i.lat && i.lon).map(i=>({lat:i.lat!, lon:i.lon!, label:i.titulo||i.direccion||''}))} />
      </div>
    </div>
  )
}
