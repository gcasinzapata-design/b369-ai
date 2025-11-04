// app/api/assistant/route.js
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { message, context } = await req.json()
    const key = process.env.OPENAI_API_KEY
    if (!key) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY faltante' }, { status: 500 })

    const prompt = `
Eres un asesor inmobiliario senior para Perú. Usa términos claros y prácticos.
Contexto: ${JSON.stringify(context || {})}
Pregunta del usuario: ${message}
Devuelve tips accionables (distritos, precios por m², negociación, riesgos de título, plusvalía, etc.).`

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    })
    if (!r.ok) {
      const t = await r.text()
      throw new Error(t)
    }
    const j = await r.json()
    const text = j?.choices?.[0]?.message?.content || 'Sin respuesta'
    return NextResponse.json({ ok: true, text })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
