export async function POST(req){
  try{
    const { messages } = await req.json()
    const key = process.env.OPENAI_API_KEY
    if (!key){
      // demo sin clave
      const last = messages?.[messages.length-1]?.content || ''
      return new Response(JSON.stringify({
        ok:true,
        reply:`(Demo) Idea de búsqueda: usa filtros por distrito, precio máximo, área mínima y habitaciones. Tu última consulta fue: "${last}".`
      }), { headers:{'content-type':'application/json'} })
    }
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${key}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role:'system', content:'Eres un asesor experto en real estate en Lima. Siempre propones filtros concretos y comparables.' },
          ...messages
        ],
        temperature: 0.3
      })
    })
    if(!r.ok) return new Response(JSON.stringify({ ok:false, error:'openai failed' }), { status:502 })
    const j = await r.json()
    const reply = j?.choices?.[0]?.message?.content || ''
    return new Response(JSON.stringify({ ok:true, reply }), { headers:{'content-type':'application/json'} })
  }catch(e){
    return new Response(JSON.stringify({ ok:false, error:e?.message||'error' }), { status:500 })
  }
}
