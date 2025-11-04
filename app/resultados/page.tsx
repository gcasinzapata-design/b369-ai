// app/resultados/page.tsx
'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import ChatAgent from '@/app/components/ChatAgent'

const MapClient = dynamic(()=>import('@/app/components/MapClient'), { ssr:false })

type Item = {
  id: string; titulo: string; precio: number; moneda: string; m2: number;
  habitaciones?: number; banos?: number; estacionamientos?: number;
  direccion?: string; fuente?: string; url?: string; lat?: number; lon?: number
}

function toCSV(rows: Item[]){
  const headers = ['id','titulo','precio','moneda','m2','habitaciones','banos','estacionamientos','fuente','url','lat','lon']
  const esc = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  return [headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${esc((r as any)[h])}"`).join(','))).join('\n')
}

export default function Resultados(){
  const [q, setQ] = useState('')
  const [district, setDistrict] = useState('')
  const [minArea, setMinArea] = useState<number|undefined>(51)
  const [minRooms, setMinRooms] = useState<number|undefined>(2)
  const [maxPriceUSD, setMaxPriceUSD] = useState<number|undefined>(250000)
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const buscar = async ()=>{
    setLoading(true); setError(null)
    try{
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ q, district, minArea, minRooms, maxPriceUSD, limit: 24 })
      })
      if(!res.ok) throw new Error(`/api/search ${res.status}`)
      const data = await res.json()
      if(!data.ok) throw new Error(data.error || 'error')
      setItems(data.items || [])
    }catch(e:any){
      setError(e?.message || 'Fallo la búsqueda'); setItems([])
    }finally{ setLoading(false) }
  }

  const exportCSV = ()=>{
    const csv = toCSV(items)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'resultados_b369.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Columna izquierda: filtros + resultados */}
      <div className="lg:col-span-2 space-y-3">
        <div className="card p-3 grid md:grid-cols-6 gap-3 items-end">
          <label className="label col-span-3">Texto libre
            <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Ej: depa vista mar"/>
          </label>
          <label className="label col-span-2">Distrito
            <input className="input" value={district} onChange={e=>setDistrict(e.target.value)} placeholder="Ej: Miraflores"/>
          </label>
          <div className="md:col-span-6 grid md:grid-cols-6 gap-3">
            <label className="label">Área mínima (m²)
              <input className="input" type="number" value={minArea??''} onChange={e=>setMinArea(e.target.value?Number(e.target.value):undefined)}/>
            </label>
            <label className="label">Hab. mín
              <input className="input" type="number" value={minRooms??''} onChange={e=>setMinRooms(e.target.value?Number(e.target.value):undefined)}/>
            </label>
            <label className="label">Precio máx (USD)
              <input className="input" type="number" value={maxPriceUSD??''} onChange={e=>setMaxPriceUSD(e.target.value?Number(e.target.value):undefined)}/>
            </label>
            <div className="flex gap-2 md:col-span-3">
              <button className="btn btn-primary" onClick={buscar} disabled={loading}>{loading?'Buscando…':'Buscar'}</button>
              <button className="btn btn-secondary" onClick={exportCSV} disabled={!items.length}>Exportar CSV</button>
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          {items.map((it)=>(
            <article key={it.id} className="card overflow-hidden">
              <div className="p-3 space-y-2">
                <div>
                  <h3 className="font-semibold">{it.titulo}</h3>
                  <p className="text-sm text-gray-600">{it.direccion}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{it.moneda==='USD'?'$':'S/ '}{(it.precio||0).toLocaleString()}</span>
                  <span className="text-sm">{it.m2||'?'} m² · {it.habitaciones ?? '-'} hab</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="badge">{(it.fuente||'web').toUpperCase()}</span>
                  <div className="flex gap-2">
                    {it.url && <a href={it.url} target="_blank" className="text-blue-600">Anuncio →</a>}
                    <a href={`/tasador?direccion=${encodeURIComponent(it.direccion||it.titulo)}&m2_construidos=${it.m2||''}&distrito=${encodeURIComponent(district||'')}`} className="text-emerald-700">Tasar →</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="card p-2 h-[520px]">
          <MapClient pins={items.filter(i=>Number.isFinite(i.lat)&&Number.isFinite(i.lon)).map(i=>({lat:i.lat!,lon:i.lon!,label:i.titulo}))}/>
        </div>
      </div>

      {/* Columna derecha: chat */}
      <div className="lg:col-span-1">
        <ChatAgent context="Búsqueda de inmuebles"/>
      </div>
    </div>
  )
}
