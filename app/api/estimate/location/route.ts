
import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { logMetric, logActivity } from '../../_telemetry'

function haversine(lat1:number, lon1:number, lat2:number, lon2:number){
  const R=6371000; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(a)))
}

export async function POST(req: Request){
  const t0 = Date.now()
  const body = await req.json()

  const file = path.join(process.cwd(), 'data', 'listings.sample.json')
  const all = JSON.parse(await fs.readFile(file, 'utf-8'))

  const comps = all.map((x:any)=>{
    const dist = haversine(body.lat, body.lng, x.lat, x.lng)
    const price_m2 = x.precio / Math.max(1, x.m2)
    return { id:x.id, precio:x.precio, m2:x.m2, dist_m: Math.round(dist), url:x.url, price_m2 }
  }).filter((c:any)=> c.dist_m <= (body.radio_m || 800)).sort((a:any,b:any)=>a.dist_m-b.dist_m)

  const priceList = comps.map((c:any)=>c.price_m2).sort((a:number,b:number)=>a-b)
  const precio_m2_zona = priceList.length ? Math.round(priceList[Math.floor(priceList.length/2)]) : 2000

  let mult = 1.0
  if (body.tipo === 'casa') mult += 0.05
  if (body.vista_mar) mult += 0.10
  if ((body.antiguedad_anos||0) > 25) mult -= 0.10
  if ((body.antiguedad_anos||0) < 5) mult += 0.05

  const estimado = Math.round(precio_m2_zona * (body.area_m2||80) * mult)
  const rango = Math.round(estimado * 0.08)

  const latency = Date.now()-t0
  logMetric('estimate', latency, precio_m2_zona)
  logActivity('estimate', `${body.tipo} ${body.area_m2} m² @ ${body.lat.toFixed(4)},${body.lng.toFixed(4)}`)

  return NextResponse.json({
    estimado, moneda: "USD",
    rango_confianza: [estimado-rango, estimado+rango],
    precio_m2_zona,
    comparables: comps.slice(0,5).map((c:any)=>({id:c.id, precio:c.precio, m2:c.m2, dist_m:Math.round(c.dist_m), url:c.url})),
    logica: { base:"Mediana precio/m² por radio", ajustes: {
      tipo: body.tipo === 'casa' ? 0.05 : 0,
      vista_mar: body.vista_mar ? 0.10 : 0,
      antiguedad: (body.antiguedad_anos||0) > 25 ? -0.10 : ((body.antiguedad_anos||0) < 5 ? 0.05 : 0)
    }}
  })
}
