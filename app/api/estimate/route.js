// app/api/estimate/route.js
import { z } from 'zod'

// ------- helpers embebidos (mismos que en /search) -------
async function parseCSV(text){
  const [head, ...rows] = text.split(/\r?\n/).filter(Boolean)
  const cols = head.split(',').map(s=>s.trim())
  return rows.map(line=>{
    const vals=[]; let cur=''; let inQ=false
    for(let i=0;i<line.length;i++){
      const ch=line[i]
      if(ch === '"'){ inQ=!inQ; continue }
      if(ch === ',' && !inQ){ vals.push(cur); cur=''; continue }
      cur += ch
    }
    vals.push(cur)
    const o={}
    cols.forEach((c,idx)=>{ o[c]=vals[idx]?.trim?.() })
    return o
  })
}
function normRow(r){
  const f = (k)=> r?.[k] ?? r?.[k?.toUpperCase?.()] ?? r?.[k?.toLowerCase?.()]
  const n = (v)=> (v==null||v==='')?undefined:Number(String(v).replace(/[^\d.]/g,''))
  const s = (v)=> (v==null?undefined:String(v).trim())
  return {
    id: s(f('id')) || s(f('url')) || s(f('titulo')),
    titulo: s(f('titulo')),
    precio: n(f('precio')),
    moneda: s(f('moneda')) || 'USD',
    m2: n(f('m2')) || n(f('area')) || n(f('area_construida')),
    habitaciones: n(f('habitaciones')) || n(f('dormitorios')),
    banos: n(f('banos')) || n(f('baños')),
    estacionamientos: n(f('estacionamientos')) || n(f('cocheras')),
    direccion: s(f('direccion')) || s(f('direccion_texto')),
    distrito: (s(f('distrito')) || s(f('zona')) || '').toLowerCase(),
    fuente: (s(f('fuente')) || '').toLowerCase(),
    url: s(f('url')),
    lat: n(f('lat')),
    lon: n(f('lon')),
    antiguedad: n(f('antiguedad')),
    tipo: (s(f('tipo')) || 'departamento').toLowerCase(),
    area_terreno: n(f('area_terreno')) || n(f('m2_terreno'))
  }
}
let MEMO_LISTINGS = { ts:0, items:[] }
async function loadListingsInline(){
  const now = Date.now()
  if (now - MEMO_LISTINGS.ts < 5*60*1000 && MEMO_LISTINGS.items.length) return MEMO_LISTINGS.items
  const env = process.env.LISTINGS_CSV_URL || ''
  const urls = env.split(',').map(s=>s.trim()).filter(Boolean)
  let all=[]
  for(const u of urls){
    try{
      const res = await fetch(u, { cache:'no-store' })
      if(!res.ok) throw new Error(`CSV ${res.status}`)
      const text = await res.text()
      const rows = await parseCSV(text)
      all = all.concat(rows.map(normRow).filter(x=>x.id && x.precio && x.m2 && x.url))
    }catch(e){ console.warn('CSV fail', u, e.message) }
  }
  const seen=new Set(), dedup=[]
  for(const it of all){ const k=it.url||it.id; if(!seen.has(k)){ seen.add(k); dedup.push(it)}}
  MEMO_LISTINGS = { ts: now, items: dedup }
  return dedup
}
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
const UA='b369-ai/1.0 (contact: admin@b369.ai)'
let GCACHE=new Map()
async function geocodeInline(address, distritoHint){
  const key = `${address}|${distritoHint||''}`.toLowerCase()
  if(GCACHE.has(key)) return GCACHE.get(key)
  const q = [address, distritoHint, 'Lima, Peru'].filter(Boolean).join(', ')
  const u = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(u, { headers:{'User-Agent':UA}})
  if(!res.ok){ GCACHE.set(key,null); return null }
  const js = await res.json()
  if(!js?.length){ GCACHE.set(key,null); return null }
  const out = { lat:Number(js[0].lat), lon:Number(js[0].lon) }
  GCACHE.set(key,out); return out
}
function haversine(lat1, lon1, lat2, lon2){
  function toRad(d){return d*Math.PI/180}
  const R=6371
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.sqrt(a))
}
function percentile(a,p){ const s=[...a].sort((x,y)=>x-y); if(!s.length) return 0; const idx=Math.max(0,Math.min(s.length-1, Math.floor((p/100)*(s.length-1)))); return s[idx]; }
// ------- /helpers -------

const ReqSchema = z.object({
  direccion: z.string().min(4),
  distrito: z.string().optional(),
  tipo: z.enum(['departamento','casa']).default('departamento'),
  area_m2: z.number().min(10),          // OBLIGATORIA
  area_terreno_m2: z.number().optional(),
  antiguedad_anos: z.number().optional(),
  vista_mar: z.boolean().optional(),
  habitaciones: z.number().optional(),
  banos: z.number().optional(),
  estacionamientos: z.number().optional()
})

export async function POST(req){
  try{
    const body = await req.json()
    const input = ReqSchema.parse(body)
    const g = await geocodeInline(input.direccion, input.distrito)
    if(!g) return new Response(JSON.stringify({ ok:false, code:'no_geocode'}), { status:200, headers:{'Content-Type':'application/json'} })

    let list=[]
    try{ list = await loadListingsInline() } catch {}

    // distancia
    for (const it of list){
      if (it.lat && it.lon) it._dist = haversine(g.lat, g.lon, it.lat, it.lon)
      else it._dist = 9999
    }
    list.sort((a,b)=>a._dist - b._dist)

    let candidates = list.slice(0, 200).filter(x=>x.precio && x.m2)
    candidates = candidates.filter(x => (x.tipo||'departamento') === input.tipo)

    // similaridad de área (±35%)
    const tol = 0.35
    candidates = candidates.filter(x => Math.abs(x.m2 - input.area_m2) <= input.area_m2 * tol)

    const soft=(v,x)=> (v==null||x==null?true:Math.abs(x-v)<=1)
    candidates = candidates.filter(x =>
      soft(input.habitaciones, x.habitaciones) &&
      soft(input.banos, x.banos) &&
      soft(input.estacionamientos, x.estacionamientos)
    )

    if (candidates.length < 25) {
      candidates = list.slice(0, 300).filter(x=>x.precio && x.m2)
    }

    const pm2 = candidates.map(x => x.precio / x.m2).filter(Number.isFinite)
    if (pm2.length < 15) {
      return new Response(JSON.stringify({ ok:false, code:'sin_comparables'}), { status:200, headers:{'Content-Type':'application/json'} })
    }

    const p25 = percentile(pm2, 25)
    const p50 = percentile(pm2, 50)
    const p75 = percentile(pm2, 75)

    let mult = 1.0
    if (input.tipo==='casa' && input.area_terreno_m2) mult += 0.03
    if (input.vista_mar) mult += 0.08
    if (input.antiguedad_anos!=null){
      if (input.antiguedad_anos < 5) mult += 0.03
      if (input.antiguedad_anos > 25) mult -= 0.06
    }

    const base = p50 * input.area_m2
    const estimado = Math.round(base * mult)
    const rango = Math.round(estimado * 0.08)
    const comps = candidates.slice(0, 40).map(x=>({
      titulo:x.titulo, direccion:x.direccion, distrito:x.distrito,
      m2:x.m2, precio:x.precio, url:x.url, lat:x.lat, lon:x.lon, fuente:x.fuente
    }))

    return new Response(JSON.stringify({
      ok:true,
      estimado,
      rango_confianza:[estimado - rango, estimado + rango],
      precio_m2_zona: Math.round(p50),
      percentiles:{ p25:Math.round(p25), p50:Math.round(p50), p75:Math.round(p75) },
      comparables: comps
    }), { status:200, headers:{'Content-Type':'application/json'} })
  }catch(e){
    return new Response(JSON.stringify({ ok:false, error:e.message || 'error' }), { status:200, headers:{'Content-Type':'application/json'} })
  }
}
