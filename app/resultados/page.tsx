
'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import ResultsGrid from '@/components/ResultsGrid'

const LeafletMap:any = dynamic(()=>import('react-leaflet').then(m=>m.MapContainer), { ssr:false })
const TileLayer:any  = dynamic(()=>import('react-leaflet').then(m=>m.TileLayer), { ssr:false })
const Marker:any     = dynamic(()=>import('react-leaflet').then(m=>m.Marker), { ssr:false })
import L from 'leaflet'

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25,41], iconAnchor:[12,41]
})

function toCSV(rows:any[]){
  const headers = ['id','titulo','precio','moneda','m2','habitaciones','fuente','url','lat','lng']
  const escape = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  const lines = [headers.join(',')]
  for(const r of rows){
    lines.push(headers.map(h=>`"${escape(r[h])}"`).join(','))
  }
  return lines.join('\n')
}

export default function Resultados(){
  const [q, setQ] = useState('depa miraflores vista mar')
  const [filters, setFilters] = useState<any>({ tipo:'departamento', min:0, max:9999999, habitaciones:0, distritos:['miraflores'] })
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const onSearch = async () => {
    setLoading(true)
    try{
      const res = await fetch('/api/search', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ q, filters, page:1, page_size:60 }) })
      const data = await res.json()
      setItems(data.results||[])
    } finally { setLoading(false) }
  }

  useEffect(()=>{ onSearch() }, [])

  const center = useMemo(()=>{
    const withCoords = items.filter(x=>typeof x.lat==='number' && typeof x.lng==='number')
    return withCoords.length ? [withCoords[0].lat, withCoords[0].lng] : [-12.123, -77.03]
  }, [items])

  const onExportCSV = () => {
    const csv = toCSV(items)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resultados_b369.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="card p-3 flex flex-wrap gap-2">
          <input className="input flex-1" value={q} onChange={e=>setQ(e.target.value)} placeholder="¿Qué buscas? Ej: depa miraflores 2 hab vista mar" />
          <button onClick={onSearch} className="btn btn-primary">{loading?'Buscando…':'Buscar'}</button>
          <button onClick={onExportCSV} className="btn btn-secondary">Exportar CSV</button>
        </div>
        <div className="card p-3 grid md:grid-cols-4 gap-2 text-sm">
          <label className="label">Distrito
            <input className="input" value={filters.distritos?.[0]||''} onChange={e=>setFilters({...filters, distritos:[e.target.value]})} />
          </label>
          <label className="label">Tipo
            <select className="input" value={filters.tipo} onChange={e=>setFilters({...filters, tipo:e.target.value})}>
              <option>departamento</option><option>casa</option>
            </select>
          </label>
          <label className="label">Min $
            <input className="input" type="number" value={filters.min} onChange={e=>setFilters({...filters, min:Number(e.target.value)})} />
          </label>
          <label className="label">Max $
            <input className="input" type="number" value={filters.max} onChange={e=>setFilters({...filters, max:Number(e.target.value)})} />
          </label>
        </div>
        <ResultsGrid items={items} />
      </div>

      <div className="card p-2">
        <LeafletMap center={center as any} zoom={14} style={{height: 520, width: '100%'}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
          {items.filter((x:any)=>typeof x.lat==='number' && typeof x.lng==='number').map((it:any,idx:number)=>(
            <Marker key={it.id||idx} position={[it.lat, it.lng]} icon={icon} />
          ))}
        </LeafletMap>
      </div>
    </div>
  )
}
