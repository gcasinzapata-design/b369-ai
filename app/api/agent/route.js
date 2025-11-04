// app/api/agent/route.js
import { NextResponse } from 'next/server'
import { extractFiltersFromText } from '../../../lib/normalize'

export async function POST(req) {
  try {
    const { messages=[], context='' } = await req.json()
    const last = messages[messages.length-1]?.content || ''
    const f = extractFiltersFromText(last)
    const must = {
      district: f.district || 'miraflores',
      minRooms: f.minRooms || 2,
      minArea: f.minArea || 50,
      maxPrice: f.maxPrice || 250000,
      tipo: f.tipo || 'departamento'
    }
    // consulta interna para devolver resultados reales
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/search`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...must, q: `${must.tipo} ${must.district}`, limit: 20 })
    }).catch(()=>null)

    let reply = ''
    if (res && res.ok) {
      const data = await res.json()
      if (data.ok && data.items?.length) {
        const top = data.items.slice(0,5).map((x,i)=>`${i+1}. ${x.titulo} — ${x.m2||'—'} m² — ${x.moneda==='USD'?'$':'S/ '}${(x.precio||0).toLocaleString()} ${x.url?`(${x.url})`:''}`).join('\n')
        reply = `Te propongo estas opciones (${must.district}, min ${must.minRooms} hab, ≥ ${must.minArea} m², hasta ${must.maxPrice} USD):\n${top}\n\n¿Quieres que ajuste filtros o te calcule la tasación de alguna?`
      } else {
        reply = `No encontré resultados con ${must.minRooms} hab, ≥ ${must.minArea} m² en ${must.district} hasta ${must.maxPrice} USD. ¿Abrimos a distritos cercanos (Barranco, San Isidro, Surco) o bajamos requisitos?`
      }
    } else {
      reply = 'No pude consultar el buscador ahora mismo. Intenta nuevamente en unos segundos.'
    }

    return NextResponse.json({ ok:true, reply })
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:500 })
  }
}
