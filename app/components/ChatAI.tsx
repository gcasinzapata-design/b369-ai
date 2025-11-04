'use client'

import { useMemo, useRef, useState } from 'react'

type Item = {
  id: string; titulo: string; precio: number; moneda: string; m2: number;
  habitaciones?: number; banos?: number; estacionamientos?: number;
  direccion?: string; url?: string; fuente?: string; lat?: number; lon?: number;
}

type Msg = { role:'user'|'assistant', content:string }

export default function ChatAI({
  items,
  filtros,
}:{
  items: Item[];
  filtros: { q:string; distrito:string; areaMin:number; habMin:number; precioMax:number };
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { role:'assistant', content: 'Hola, soy tu asesor inmobiliario. Pídeme que afine filtros, compare opciones o estime el precio m² por zona 👋' }
  ])
  const [inp, setInp]         = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement|null>(null)

  const context = useMemo(()=>({
    filtros,
    muestras: items.slice(0,12).map(i=>({
      titulo:i.titulo, precio:i.precio, moneda:i.moneda, m2:i.m2,
      habitaciones:i.habitaciones??null, direccion:i.direccion??null, url:i.url??null, fuente:i.fuente??null,
      lat:i.lat??null, lon:i.lon??null
    }))
  }),[items, filtros])

  async function send(){
    const text = inp.trim()
    if(!text) return
    const next = [...messages, { role:'user', content:text } as Msg]
    setMessages(next); setInp(''); setLoading(true)
    try{
      const r = await fetch('/api/ask', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ messages: next, context })
      })
      const data = await r.json()
      if(!r.ok || !data.ok) throw new Error(data.error || 'Fallo en IA')
      setMessages(m=>[...m, { role:'assistant', content:data.answer }])
    }catch(e:any){
      setMessages(m=>[...m, { role:'assistant', content:`⚠ ${e?.message || 'No pude responder ahora.'}` }])
    }finally{
      setLoading(false)
      setTimeout(()=> endRef.current?.scrollIntoView({ behavior:'smooth' }), 50)
    }
  }

  function onKey(e:React.KeyboardEvent<HTMLInputElement>){
    if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="card h-[520px] flex flex-col overflow-hidden">
      <div className="p-3 border-b font-semibold">Asesor IA (Real Estate)</div>
      <div className="flex-1 overflow-auto space-y-3 p-3">
        {messages.map((m, i)=>(
          <div key={i} className={m.role==='assistant' ? 'text-sm bg-gray-50 p-2 rounded-lg' : 'text-sm bg-emerald-50 p-2 rounded-lg ml-8'}>
            {m.content}
          </div>
        ))}
        <div ref={endRef}/>
      </div>
      <div className="p-3 border-t flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ej: ¿Cuál es el precio m² típico en Miraflores para 2 hab?"
          value={inp}
          onChange={e=>setInp(e.target.value)}
          onKeyDown={onKey}
        />
        <button className="btn btn-primary" onClick={send} disabled={loading}>{loading?'Pensando…':'Enviar'}</button>
      </div>
    </div>
  )
}
