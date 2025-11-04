'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import ChatAI from '../components/ChatAI'

type Item = {
  id:string; titulo:string; precio:number; moneda:string; m2:number;
  habitaciones?:number; banos?:number; estacionamientos?:number;
  direccion?:string; fuente?:string; url?:string; lat?:number; lon?:number;
}
const MapClient = dynamic(()=>import('../components/MapClient'), { ssr:false })

function toCSV(rows: Item[]){
  const headers = ['id','titulo','precio','moneda','m2','habitaciones','banos','estacionamientos','fuente','url']
  const esc = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  return [headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${esc((r as any)[h])}"`).join(','))).join('\n')
}

export default function Resultados(){
  const [q, setQ] = useState('departamento miraflores')
  const [distrito, setDistrito] = useState('Miraflores')
  const [areaMin, setAreaMin] = useState(60)
  const [habMin, setHabMin] = useState(2)
  const [precioMax, setPrecioMax] = useState(400000)

  const [items, setItems] = useState<Item[]>([])
  const [center, setCenter] = useState<{lat:number;lon:number}|null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const filtros = useMemo(()=>({ q, distrito, areaMin:Number(areaMin), habMin:Number(habMin), precioMax:Number(precioMax) }), [q,distrito,areaMin,habMin,precioMax])

  const buscar = async ()=>{
    setLoading(true); setError(null)
    try{
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ q, filtros })
      })
      if(!res.ok) throw new Error(`API /api/search ${res.status}`)
      const data = await res.json()
      if(!data.ok) throw new Error(data.error || 'error')
      setItems(data.items || [])
      setCenter(data.center || null)
    }catch(e:any){
      setError(e?.message || 'Fallo la búsqueda')
      setItems([]); setCenter(null)
    }finally{
      setLoading(false)
    }
  }

  const exportCSV = ()=>{
    const csv = toCSV(items)
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='resultados_b369.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Columna 1: filtros + resultados */}
      <div className="space-y-3">
        <div className="card p-3 grid md:grid-cols-5 gap-2">
          <input className="input md:col-span-2" value={q} onChange={e=>setQ(e.target.value)} placeholder="depa miraflores 2 hab"/>
          <input className="input" value={distrito} onChange={e=>setDistrito(e.target.value)} placeholder="Distrito (obligatorio)"/>
          <input className="input" type="number" value={areaMin} onChange={e=>setAreaMin(Number(e.target.value))} placeholder="Área mín (m²)"/>
          <input className="input" type="number" value={habMin} onChange={e=>setHabMin(Number(e.target.value))} placeholder="Hab mín"/>
          <input className="input" type="number" value={precioMax} onChange={e=>setPrecioMax(Number(e.target.value))} placeholder="Precio máx"/>
          <div className="md:col-span-5 flex gap-2">
            <button className="btn btn-primary" onClick={buscar} disabled={loading}>{loading?'Buscando…':'Buscar'}</button>
            <button className="btn btn-secondary" onClick={exportCSV} disabled={!items.length}>Exportar CSV</button>
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

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
                  <span className="text-sm">{it.m2} m² · {it.habitaciones ?? '-'} hab</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="badge">{(it.fuente||'web').toUpperCase()}</span>
                  <div className="flex gap-2">
                    {it.url && <a href={it.url} target="_blank" className="text-blue-600">Anuncio →</a>}
                    <a href={`/tasador?direccion=${encodeURIComponent(it.direccion||it.titulo)}&areaConstruida_m2=${it.m2}`} className="text-emerald-700">Tasar →</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!loading && !error && !items.length && <div className="text-sm text-gray-500">Sin resultados aún. Prueba: “depa miraflores 2 hab”.</div>}
        </div>
      </div>

      {/* Columna 2: mapa */}
      <div className="card p-2 h-[520px]">
        <MapClient center={center} pins={items.filter(i=>i.lat&&i.lon).map(i=>({ lat:i.lat!, lon:i.lon!, label:i.titulo }))}/>
      </div>

      {/* Columna 3: chat IA */}
      <ChatAI items={items} filtros={filtros}/>
    </div>
  )
}
