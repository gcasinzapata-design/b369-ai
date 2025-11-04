// app/components/ChatAgent.tsx
'use client'
import { useState } from 'react'

type Msg = { role: 'user'|'assistant'; content: string }

export default function ChatAgent({ context }:{ context?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role:'assistant', content:'Hola, soy tu asesor inmobiliario. Pídeme que afine filtros, compare opciones o estime el precio m² por zona 👋' }])
  const [input, setInput] = useState('')

  const send = async () => {
    if (!input.trim()) return
    const newMsgs: Msg[] = [...msgs, { role:'user', content: input }]
    setMsgs(newMsgs); setInput('')
    const res = await fetch('/api/agent', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ messages:newMsgs, context })
    })
    const data = await res.json().catch(()=>({ ok:false }))
    const text = data?.message || 'No pude responder ahora. Ajusta filtros o repite tu consulta.'
    setMsgs(m => [...m, { role:'assistant', content: text }])
  }

  return (
    <div className="card p-3 flex flex-col h-[520px]">
      <div className="text-sm font-semibold mb-2">Asesor Inmobiliario</div>
      <div className="flex-1 overflow-auto space-y-2 text-sm">
        {msgs.map((m,i)=>(
          <div key={i} className={m.role==='user'?'text-right':''}>
            <div className={`inline-block px-3 py-2 rounded-lg ${m.role==='user'?'bg-brand-800 text-white':'bg-gray-100'}`}>{m.content}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input flex-1" value={input} onChange={e=>setInput(e.target.value)} placeholder="Ej: depa 2 hab en Sani hasta 250K"/>
        <button className="btn btn-primary" onClick={send}>Enviar</button>
      </div>
    </div>
  )
}
