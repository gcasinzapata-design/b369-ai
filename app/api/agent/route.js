// app/api/agent/route.js
import { NextResponse } from 'next/server'

function normalize(text='') {
  let t = text.toLowerCase()
  t = t.replace(/\b(sani|san isidro|sanisidro)\b/g, 'San Isidro')
       .replace(/\b(barra|barran)\b/g, 'Barranco')
       .replace(/\b(mira|miraf)\b/g, 'Miraflores')
       .replace(/\b(surco|ssd)\b/g, 'Santiago de Surco')
       .replace(/(\d+)\s?k\b/gi, (_,n)=> String(Number(n)*1000))
       .replace(/\bdepa\b/g, 'departamento')
  return t
}

export async function POST(req) {
  try {
    const { messages=[], context='' } = await req.json()
    const sys = `Eres un asesor inmobiliario experto en Lima, Perú. Usa datos del endpoint /api/search cuando te pidan buscar.
Responde en español, breve y accionable. Si no hay resultados, sugiere ampliar filtros (distrito, área mínima, presupuesto). Contexto: ${context||'N/A'}`

    const userLast = messages[messages.length-1]?.content || ''
    const q = normalize(userLast)

    // Pequeña llamada al propio backend para obtener números reales
    let snippet = ''
    try {
      const res = await fetch(new URL('/api/search', req.url), {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ q, limit: 8 })
      })
      const j = await res.json()
      if (j?.ok && Array.isArray(j.items) && j.items.length) {
        const first = j.items.slice(0,3).map(it => `• ${it.titulo} — ${it.m2||'?'} m² — ${it.moneda==='USD'?'$':'S/ '}${(it.precio||0).toLocaleString()} — ${it.fuente}${it.url?` — ${it.url}`:''}`).join('\n')
        snippet = `Resultados:\n${first}`
      } else {
        snippet = 'Sin resultados con esos filtros.'
      }
    } catch { snippet = 'No pude consultar resultados en este momento.' }

    // Si tienes gpt-4o-mini / gpt-4.1-mini en tu cuenta, puedes llamarlo aquí.
    // Para simplificar y evitar dependencias SDK, respondemos con una redacción semi-determinística usando snippet.
    const reply = snippet.includes('Resultados:')
      ? `Encontré opciones que encajan. ${snippet}\n¿Quieres que afine por distrito, área mínima o incluya cochera?`
      : `No veo coincidencias con esos filtros. Prueba bajar área mínima, subir precio máx o probar San Isidro/Barranco/Surco. Puedo ajustar por ti.`

    return NextResponse.json({ ok:true, message: reply })
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e.message||e) }, { status:400 })
  }
}
