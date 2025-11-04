'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
const MapClient = dynamic(() => import('../components/MapClient'), { ssr:false })

type Item = {
  id: string; titulo: string; precio: number; moneda: string; m2: number;
  habitaciones?: number; banos?: number; estacionamientos?: number;
  direccion?: string; fuente?: string; url?: string; lat?:number; lon?:number
}

function toCSV(rows: Item[]){
  const headers = ['id','titulo','precio','moneda','m2','habitaciones','banos','estacionamientos','direccion','fuente','url','lat','lon']
  const esc = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  return [headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${esc((r as any)[h])}"`).join(','))).join('\n')
}

export default function Resultados(){
  const [district, setDistrict] = useState('miraflores')
  const [minRooms, setMinRooms] = useState(2)
  const [minArea, setMinArea] = useState(50)
  const [maxPrice, setMaxPrice] = useState(250000)
  const [tipo, setTipo] = useState<'departamento'|'casa'>('departamento')

  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const buscar = async ()=>{
    setLoading(true); setError(null)
    try{
      if (!district || !minArea || !minRooms || !maxPrice) {
        throw new Error('Completa distrito, área mínima, habitaciones mínimas y precio máximo.')
      }
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ q:`${tipo} ${district}`, district, minArea, minRooms, maxPrice, tipo, limit: 50 })
      })
      if(!res.ok){
        const t = await res.text()
        throw new Error(`/api/search ${res.status} – ${t}`)
      }
      const data = await res.json()
      if(!data.ok) throw new Error(data.error || 'error')
      setItems(data.items || [])
    }catch(e:any){
      setError(e?.message || 'Fallo la búsqueda')
      setItems([])
    }finally{
      setLoading(false)
    }
  }

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
        <div className="card p-3 grid grid-cols-2 gap-3">
          <label className="label col-span-2">Distrito
            <input className="input" value={district} onChange={e=>setDistrict(e.target.value)} placeholder="Ej: miraflores"/>
          </label>
          <label className="label">Tipo
            <select className="input" value={tipo} onChange={e=>setTipo(e.target.value as any)}>
              <option value="departamento">departamento</option>
              <option value="casa">casa</option>
            </select>
          </label>
          <label className="label">Habit. mín.
            <input className="input" type="number" value={minRooms} onChange={e=>setMinRooms(Number(e.target.value))}/>
          </label>
          <label className="label">Área mín. (m²)
            <input className="input" type="number" value={minArea} onChange={e=>setMinArea(Number(e.target.value))}/>
          </label>
          <label className="label">Precio máx. (USD)
            <input className="input" type="number" value={maxPrice} onChange={e=>setMaxPrice(Number(e.target.value))}/>
          </label>
          <div className="flex items-end gap-2 col-span-2">
            <button className="btn btn-primary" onClick={buscar} disabled={loading}>{loading?'Buscando…':'Buscar'}</button>
            <button className="btn btn-secondary" onClick={exportCSV} disabled={!items.length}>Exportar CSV</button>
          </div>
          {error && <div className="col-span-2 text-sm text-red-600">{error}</div>}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((it)=>(
            <article key={it.id} className="card overflow-hidden">
              <div className="p-3 space-y-2">
                <div>
                  <h3 className="font-semibold">{it.titulo}</h3>
                  <p className="text-sm text-gray-600">{it.direccion || '—'}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{it.moneda==='USD'?'$':'S/ '}{(it.precio||0).toLocaleString()}</span>
                  <span className="text-sm">{it.m2 || '—'} m² · {it.habitaciones ?? '—'} hab</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="badge">{(it.fuente||'web').toUpperCase()}</span>
                  <div className="flex gap-2">
                    {it.url && <a href={it.url} target="_blank" className="text-blue-600">Anuncio →</a>}
                    <a href={`/tasador?direccion=${encodeURIComponent(it.direccion || it.titulo)}&district=${encodeURIComponent(district)}&areaConstruida_m2=${it.m2||''}&tipo=${tipo}`} className="text-emerald-700">Tasar →</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!loading && !error && !items.length && <div className="text-sm text-gray-500">Sin resultados. Prueba bajar área mínima o subir precio máx, o cambiar a Barranco/Surco/San Isidro.</div>}
        </div>
      </div>

      <div className="card p-2 h-[520px] overflow-hidden">
        <MapClient pins={items.filter(i=>i.lat&&i.lon).map(i=>({lat:i.lat!, lon:i.lon!, label:i.titulo?.slice(0,40)||'prop'}))}/>
      </div>
    </div>
  )
}
