// app/api/ask/route.js
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const sysPrompt = `
Eres un asesor inmobiliario senior, especializado en Perú (Lima y provincias).
Objetivo: ayudar a usuario a buscar inmuebles, interpretar resultados y sugerir mejoras de filtros.
Reglas:
- Responde en español, tono claro y profesional.
- Si no hay resultados suficientes, sugiere ampliar rangos (distrito cercano, área mín, presupuesto, hab mín).
- Cuando sea útil, calcula precio por m² (precio/m2) y menciona percentiles (P25/P50/P75) si hay datos.
- No inventes enlaces ni datos: usa únicamente lo que viene en "context".
- Si el usuario pide estimación aproximada, sé explícito en los supuestos y en la incertidumbre.
- Si te piden zonas seguras, cercanía a parques/colegios/comercios, da recomendaciones generales (no afirmaciones absolutas).
- Formato: párrafos breves + bullets cuando convenga. Nada de código salvo que lo pidan.
`

export async function POST(req){
  try{
    const { messages, context } = await req.json()
    if(!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok:false, error:'OPENAI_API_KEY no configurada' }, { status:500 })
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const userContext = JSON.stringify(context || {})
    const chat = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role:'system', content: sysPrompt },
        { role:'system', content: `context=${userContext}` },
        ...sanitize(messages)
      ]
    })

    const answer = chat.choices?.[0]?.message?.content?.trim() || 'No tengo respuesta por ahora.'
    return NextResponse.json({ ok:true, answer })
  }catch(e){
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:500 })
  }
}

function sanitize(msgs){
  if(!Array.isArray(msgs)) return []
  return msgs
    .filter(m=> m && (m.role==='user' || m.role==='assistant') && typeof m.content==='string')
    .slice(-12) // mantener corto
}
