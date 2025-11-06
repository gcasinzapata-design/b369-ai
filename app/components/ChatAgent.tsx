// app/components/ChatAgent.tsx
'use client'
import { useState } from 'react'

type Role = 'user' | 'assistant'
type Msg = { role: Role; content: string }

export default function ChatAgent({ context }: { context?: any }){
  const [msgs, setMsgs] = useState<Msg[]>([{ role:'assistant', content:'Hola, soy tu asesor inmobiliario. Pídeme que afine filtros o estime precio m² por zona.' }])
  const [input, setInput] = useState('')

  const send = async ()=>{
    if(!input.trim()) return
    const newMsgs: Msg[] = [...msgs, {role:'user', content:input}]
    setMsgs(newMsgs); setInput('')
    const res = await fetch('/api/agent', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ messages:newMsgs, context })
    })
    const data = await res.json()
    if (data?.ok && data?.reply) setMsgs(m => [...m, { role:'assistant', content:data.reply }])
  }

  return (
    <div className="card p-3 flex flex-col gap-2 h-[560px]">
      <div className="flex-1 overflow-auto space-y-2">
        {msgs.map((m,i)=>(
          <div key={i} className={m.role==='user'?'text-right':''}>
            <span className={`inline-block px-3 py-2 rounded-lg text-sm ${m.role==='user'?'bg-brand-800 text-white':'bg-gray-100'}`}>{m.content}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Ej: depa 2 hab miraflores 250K" value={input} onChange={e=>setInput(e.target.value)} />
        <button className="btn btn-primary" onClick={send}>Enviar</button>
      </div>
    </div>
  )
}
