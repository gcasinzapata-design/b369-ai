// app/api/agent/route.js
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export async function POST(req){
  try{
    const { messages=[], context=[] } = await req.json().catch(()=> ({}))
    if(!OPENAI_API_KEY) return NextResponse.json({ ok:false, answer:'Falta OPENAI_API_KEY' }, { status:200 })

    const ctxText = context.slice(0,20).map((it,i)=>(
      `#${i+1}: ${it.titulo||''} — ${it.m2||'?'} m² — $${it.precio||'?'} — ${it.direccion||''} — ${it.url||''}`
    )).join('\n')

    const prompt = `
Eres un asesor inmobiliario senior en Lima/Perú. Da respuestas concisas y accionables.
Cuando sugieras cambios de filtros, usa razonamiento de mercado local.
Contexto (listings actuales):
${ctxText || '(sin contexto)'}
`

    const client = new OpenAI({ apiKey: OPENAI_API_KEY })
    const userLast = messages[messages.length-1]?.content || ''
    const sysMsg = { role:'system', content: prompt }
    const chat = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [sysMsg, ...messages.map(m=>({ role:m.role, content:m.content }))]
    })
    const answer = chat.choices?.[0]?.message?.content || 'Sin respuesta'
    return NextResponse.json({ ok:true, answer })
  }catch(e){
    return NextResponse.json({ ok:false, answer:String(e?.message||e) }, { status:200 })
  }
}
