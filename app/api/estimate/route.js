import fs from 'node:fs/promises'
import path from 'node:path'

const R_EARTH = 6371
function haversine(lat1, lon1, lat2, lon2){
  const dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return 2*R_EARTH*Math.asin(Math.sqrt(a))
}
function median(arr){ if(!arr.length) return 2000; const s=[...arr].sort((a,b)=>a-b); const i=Math.floor(s.length/2); return s.length%2?s[i]:(s[i-1]+s[i])/2 }

async function geocode(addr){
  const base = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org'
  const url = `${base}/search?format=json&q=${encodeURIComponent(addr)}&limit=1`
  const r = await fetch(url, { headers: { 'User-Agent': 'b369-ai/1.0 (netlify)' } })
  if(!r.ok) return null; const a = await r.json(); if(!a?.length) return null
  return { lat: Number(a[0].lat), lon: Number(a[0].lon) }
}
async function loadMock(){
  const file = path.join(process.cwd(), 'public', 'mock.json')
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

export async function POST(req){
  try{
    const b = await req.json()
    const tipo = b?.tipo==='casa'?'casa':'departamento'
    const area_m2 = Math.max(1, Number(b?.area_m2||80))
    const antiguedad_anos = Number(b?.antiguedad_anos||0)
    const vista_mar = !!b?.vista_mar
    const habitaciones = Number(b?.habitaciones||0)
    const banos = Number(b?.banos||0)
    const estacionamientos = Number(b?.estacionamientos||0)

    const g = b?.direccion ? await geocode(b.direccion) : null

    let comps = await loadMock()
    // Si tenemos coordenadas, priorizamos radio 3km
    if (g){
      // si tus comparables reales tienen lat/lon, aquí filtras por distancia
      comps = await Promise.all(comps.map(async c=>{
        if (c.lat && c.lon) return c
        if (c.direccion){
          const cg = await geocode(c.direccion)
          return cg ? {...c, lat: cg.lat, lon: cg.lon} : c
        }
        return c
      }))
      comps = comps.filter(c => (c.lat && c.lon) ? haversine(g.lat,g.lon,c.lat,c.lon) <= 3.0 : true)
    }

    // afinidad por características
    comps = comps.filter(c=>{
      const okArea = !c.m2 || Math.abs(c.m2 - area_m2) <= area_m2*0.35
      const okHab = !c.habitaciones || (habitaciones ? Math.abs(c.habitaciones - habitaciones) <= 1 : true)
      return okArea && okHab
    })

    // toma hasta 40 comps
    comps = comps.slice(0, 40)

    const pM2 = median(comps.filter(c=>c.m2>0).map(c=>c.precio/c.m2))
    let mult = 1.0
    if (tipo==='casa') mult += 0.05
    if (vista_mar) mult += 0.10
    if (antiguedad_anos > 25) mult -= 0.10
    if (antiguedad_anos > 0 && antiguedad_anos < 5) mult += 0.05
    if (habitaciones >= 3) mult += 0.03
    if (habitaciones >= 4) mult += 0.02
    if (banos >= 2) mult += 0.02
    if (banos >= 3) mult += 0.02
    if (estacionamientos >= 1) mult += 0.02
    if (estacionamientos >= 2) mult += 0.02

    const estimado = Math.round(pM2 * area_m2 * mult)
    const rango = Math.round(estimado * 0.08)

    return new Response(JSON.stringify({
      ok:true,
      estimado,
      rango_confianza:[estimado-rango, estimado+rango],
      precio_m2_zona: Math.round(pM2),
      comparables: comps
    }), { headers: { 'content-type':'application/json' } })
  }catch(e){
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'error' }), { status:500 })
  }
}

export async function GET(){ return new Response(JSON.stringify({ok:true, ping:'estimate alive'}), { headers:{'content-type':'application/json'} }) }
