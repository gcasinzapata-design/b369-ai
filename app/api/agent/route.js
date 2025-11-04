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
Sugiere ajustar filtros si no hay matches. Si hay, sugiere 3 opciones concretas.
Contexto de resultados:
${ctxText || '(sin contexto)'}
`
    const client = new OpenAI({ apiKey: OPENAI_API_KEY })
    const chat = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [{ role:'system', content: prompt }, ...messages]
    })
    const answer = chat.choices?.[0]?.message?.content || 'Sin respuesta'
    return NextResponse.json({ ok:true, answer })
  }catch(e){
    return NextResponse.json({ ok:false, answer:String(e?.message||e) }, { status:200 })
  }
}
