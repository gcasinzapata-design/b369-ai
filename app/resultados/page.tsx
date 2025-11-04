'use client'
import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
const MapClient = dynamic(()=>import('../../components/MapClient'), { ssr:false })

type Item = {
  id: string; titulo: string; precio: number; moneda: string; m2: number;
  habitaciones?: number; banos?: number; estacionamientos?: number;
  direccion?: string; fuente?: string; url?: string; lat?: number; lon?: number
}

function toCSV(rows: Item[]){
  const headers = ['id','titulo','precio','moneda','m2','habitaciones','banos','estacionamientos','fuente','url']
  const esc = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  return [headers.join(',')].concat(rows.map(r=>headers.map(h=>`"${esc((r as any)[h])}"`).join(','))).join('\n')
}

export default function Resultados(){
  const [q, setQ] = useState('')
  const [distrito, setDistrito] = useState('')
  const [minArea, setMinArea] = useState<number|''>('')
  const [minHab, setMinHab] = useState<number|''>('')
  const [maxPrecio, setMaxPrecio] = useState<number|''>('')
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const pins = useMemo(()=> items.filter(i=>i.lat && i.lon).map(i=>({
    lat:i.lat!, lon:i.lon!, label: `${i.titulo} — ${(i.moneda==='USD'?'$':'S/ ')+i.precio.toLocaleString()}`
  })), [items])

  const buscar = async ()=>{
    setLoading(true); setError(null)
    try{
      const res = await fetch('/api/search', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          q, distrito: distrito || undefined,
          minArea: minArea? Number(minArea): undefined,
          minHab: minHab? Number(minHab): undefined,
          maxPrecio: maxPrecio? Number(maxPrecio): undefined
        })
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
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='resultados_b369.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid md:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-3">
        <div className="card p-3 grid md:grid-cols-5 gap-2">
          <input className="input md:col-span-2" value={q} onChange={e=>setQ(e.target.value)} placeholder="Texto libre (ej: depa miraflores 2 hab)" />
          <input className="input" placeholder="Distrito" value={distrito} onChange={e=>setDistrito(e.target.value)} />
          <input className="input" type="number" placeholder="Área mínima" value={minArea} onChange={e=>setMinArea(e.target.value===''?'':Number(e.target.value))}/>
          <input className="input" type="number" placeholder="Hab mín" value={minHab} onChange={e=>setMinHab(e.target.value===''?'':Number(e.target.value))}/>
          <input className="input" type="number" placeholder="Precio máx" value={maxPrecio} onChange={e=>setMaxPrecio(e.target.value===''?'':Number(e.target.value))}/>
          <div className="flex gap-2 md:col-span-2">
            <button className="btn btn-primary flex-1" onClick={buscar} disabled={loading}>{loading?'Buscando…':'Buscar'}</button>
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
                  <span className="text-sm">{it.m2} m² · {(it.habitaciones??'-')} hab</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="badge">{(it.fuente||'web').toUpperCase()}</span>
                  <div className="flex gap-2">
                    {it.url && <a href={it.url} target="_blank" className="text-blue-600">Anuncio →</a>}
                    <a href={`/tasador?area_m2=${it.m2}&direccion=${encodeURIComponent(it.direccion || it.titulo)}`} className="text-emerald-700">Tasar →</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="card p-2">
          <MapClient pins={pins} />
        </div>
      </div>

      {/* Chat asesor */}
      <aside className="card p-3 flex flex-col gap-2">
        <b>Asesor IA (Real Estate)</b>
        <ChatBox />
      </aside>
    </div>
  )
}

function ChatBox(){
  const [history, setHistory] = useState<{role:'user'|'assistant'; content:string}[]>([
    { role:'assistant', content:'Hola, soy tu asesor. Dime distrito, precio máx, área mínima y cuántas habitaciones necesitas.' }
  ])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async ()=>{
    if(!msg.trim()) return
    const messages = [...history, { role:'user' as const, content: msg }]
    setHistory(messages); setMsg(''); setLoading(true)
    try{
      const r = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages }) })
      const j = await r.json()
      setHistory(h => [...h, { role:'assistant', content: j.ok ? j.reply : 'No disponible.' }])
    }finally{ setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-2 h-[520px]">
      <div className="flex-1 overflow-auto border rounded-lg p-2 bg-white">
        {history.map((m,i)=>(
          <div key={i} className={`mb-2 ${m.role==='assistant'?'text-gray-800':'text-emerald-800'}`}>
            <b>{m.role==='assistant'?'Asesor':'Tú'}:</b> <span className="whitespace-pre-wrap">{m.content}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Ej: Miraflores, S/ 600k, 80 m², 2 hab"/>
        <button className="btn btn-primary" onClick={send} disabled={loading}>{loading?'Enviando…':'Enviar'}</button>
      </div>
    </div>
  )
}
