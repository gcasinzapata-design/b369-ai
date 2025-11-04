'use client'
import { useState } from 'react'

export default function ChatAgent({ context=[] }:{ context:any[] }){
  const [msgs, setMsgs] = useState<{role:'user'|'assistant', content:string}[]>([
    { role:'assistant', content:'Hola, soy tu agente inmobiliario IA. Dime distrito, área mínima y presupuesto y te afino la búsqueda.'}
  ])
  const [input, setInput] = useState('')
  const send = async ()=>{
    if(!input.trim()) return
    const newMsgs=[...msgs, {role:'user', content:input}]
    setMsgs(newMsgs); setInput('')
    const res = await fetch('/api/agent', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ messages:newMsgs, context })
    })
    const data = await res.json().catch(()=> ({}))
    setMsgs(m=>[...m, { role:'assistant', content: data.answer || 'No pude responder ahora.' }])
  }
  return (
    <div className="card p-3 h-[520px] flex flex-col">
      <div className="text-sm text-gray-600 mb-2">Agente IA (experto en Real Estate)</div>
      <div className="flex-1 overflow-auto space-y-2">
        {msgs.map((m,i)=>(
          <div key={i} className={m.role==='assistant' ? 'text-sm bg-gray-50 p-2 rounded' : 'text-sm text-right'}>
            {m.content}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input flex-1" value={input} onChange={e=>setInput(e.target.value)} placeholder="Ej: depa Miraflores 2 hab hasta $220k"/>
        <button onClick={send} className="btn btn-primary">Enviar</button>
      </div>
    </div>
  )
}
