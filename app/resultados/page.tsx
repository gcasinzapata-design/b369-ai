'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import ChatAgent from '../components/ChatAgent'
const MapClient = dynamic(()=>import('../components/MapClient'), { ssr:false })

type Item = {
  id: string; titulo: string; precio: number; moneda: string; m2: number;
  habitaciones?: number; banos?: number; estacionamientos?: number;
  direccion?: string; fuente?: string; url?: string; lat?:number; lon?:number
}

function toCSV(rows: Item[]){
  const headers = ['id','titulo','precio','moneda','m2','habitaciones','banos','estacionamientos','fuente','url','lat','lon']
  const esc = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  return [headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${esc((r as any)[h])}"`).join(','))).join('\n')
}

export default function Resultados(){
  const [q, setQ] = useState('departamento miraflores 2 habitaciones')
  const [filtros, setFiltros] = useState({ distrito:'Miraflores', areaMin:60, habMin:2, precioMax:250000 })
  const [items, setItems] = useState<Item[]>([])
  const [center, setCenter] = useState<{lat:number; lon:number} | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const buscar = async ()=>{
    if(!filtros.distrito || filtros.distrito.length<3) return setError('Distrito es obligatorio.')
    if(!filtros.areaMin || filtros.areaMin<10) return setError('Área mínima debe ser ≥ 10 m².')
    if(!filtros.precioMax || filtros.precioMax<1000) return setError('Precio máximo inválido.')
    setLoading(true); setError(null)
    try{
      const res = await fetch('/api/search', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ q, filtros })
      })
      if(!res.ok){ throw new Error(`API /api/search ${res.status}`) }
      const data = await res.json()
      if(!data.ok) throw new Error(data.error || 'error')
      setItems(data.items || []); setCenter(data.center || null)
      if(!(data.items||[]).length){
        setError('Sin resultados con esos filtros. Sugerencia: aumenta precio máximo o baja área mínima.')
      }
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

  const pins = items.filter(x=>x.lat&&x.lon).map(x=>({ lat:x.lat!, lon:x.lon!, label:x.titulo }))

  return (
    <div className="grid xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-3">
        <div className="card p-3 grid md:grid-cols-5 gap-2">
          <input className="input md:col-span-2" value={q} onChange={e=>setQ(e.target.value)} placeholder="Ej: depa miraflores 2 hab vista mar"/>
          <input className="input" placeholder="Distrito" value={filtros.distrito} onChange={e=>setFiltros({...filtros, distrito:e.target.value})}/>
          <input className="input" type="number" placeholder="Área min (m²)" value={filtros.areaMin} onChange={e=>setFiltros({...filtros, areaMin:Number(e.target.value)})}/>
          <input className="input" type="number" placeholder="Hab mín" value={filtros.habMin} onChange={e=>setFiltros({...filtros, habMin:Number(e.target.value)})}/>
          <input className="input" type="number" placeholder="Precio máx (USD)" value={filtros.precioMax} onChange={e=>setFiltros({...filtros, precioMax:Number(e.target.value)})}/>
          <div className="md:col-span-5 flex gap-2">
            <button className="btn btn-primary" onClick={buscar} disabled={loading}>{loading?'Buscando…':'Buscar'}</button>
            <button className="btn btn-secondary" onClick={exportCSV} disabled={!items.length}>Exportar CSV</button>
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
                  <span className="text-lg font-bold">{it.moneda==='USD'?'$':'S/ '}{it.precio.toLocaleString()}</span>
                  <span className="text-sm">{it.m2} m² · {(it.habitaciones ?? '-')} hab</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="badge">{(it.fuente||'web').toUpperCase()}</span>
                  <div className="flex gap-2">
                    {it.url && <a href={it.url} target="_blank" className="text-blue-600">Anuncio →</a>}
                    <a href={`/tasador?areaConstruida_m2=${it.m2}&direccion=${encodeURIComponent(it.direccion || it.titulo)}`} className="text-emerald-700">Tasar →</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!loading && !error && !items.length && <div className="text-sm text-gray-500">Sin resultados aún. Prueba: “depa miraflores 2 hab”</div>}
        </div>

        <div className="card p-2">
          <MapClient pins={pins} center={center ?? undefined}/>
        </div>
      </div>

      <div className="xl:col-span-1">
        <ChatAgent context={items}/>
      </div>
    </div>
  )
}
