// app/api/search/route.js
import { z } from 'zod'

// ---------- Helpers embebidos ----------
async function parseCSV(text) {
  // parser muy simple (si luego quieres usar papaparse, lo cambiamos)
  const [head, ...rows] = text.split(/\r?\n/).filter(Boolean)
  const cols = head.split(',').map(s=>s.trim())
  return rows.map(line => {
    const vals = []; let cur = ''; let inQ = false
    for (let i=0;i<line.length;i++){
      const ch=line[i]
      if (ch === '"' ){ inQ = !inQ; continue }
      if (ch === ',' && !inQ){ vals.push(cur); cur=''; continue }
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
  for (const u of urls){
    try{
      const res = await fetch(u, { cache:'no-store' })
      if(!res.ok) throw new Error(`CSV ${res.status}`)
      const text = await res.text()
      const rows = await parseCSV(text)
      all = all.concat(rows.map(normRow).filter(x=>x.id && x.precio && x.m2 && x.url))
    }catch(e){ console.warn('CSV fail', u, e.message) }
  }
  const seen = new Set(); const dedup=[]
  for (const it of all){ const k = it.url || it.id; if(!seen.has(k)){ seen.add(k); dedup.push(it) } }
  MEMO_LISTINGS = { ts: now, items: dedup }
  return dedup
}

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
const UA = 'b369-ai/1.0 (contact: admin@b369.ai)'
let GCACHE = new Map()
async function geocodeInline(address, distritoHint){
  const key = `${address}|${distritoHint||''}`.toLowerCase()
  if (GCACHE.has(key)) return GCACHE.get(key)
  const q = [address, distritoHint, 'Lima, Peru'].filter(Boolean).join(', ')
  const u = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(u, { headers:{'User-Agent':UA}})
  if(!res.ok){ GCACHE.set(key,null); return null }
  const js = await res.json()
  if(!js?.length){ GCACHE.set(key,null); return null }
  const out = { lat:Number(js[0].lat), lon:Number(js[0].lon) }
  GCACHE.set(key,out); return out
}

const CSE_KEY = process.env.GOOGLE_CSE_KEY
const CSE_CX  = process.env.GOOGLE_CSE_CX
async function cseSearchInline(query){
  if(!CSE_KEY || !CSE_CX) return []
  const u = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${CSE_KEY}&cx=${CSE_CX}&num=10`
  const res = await fetch(u, { cache:'no-store' })
  if(!res.ok) return []
  const js = await res.json()
  return (js.items||[]).map(i=>({ url:i.link, titulo:i.title, snippet:i.snippet }))
}
// ---------- /helpers ----------

const QSchema = z.object({
  q: z.string().optional().default(''),
  filtros: z.object({
    distrito: z.string().optional(),
    precio_max: z.number().optional(),
    area_min: z.number().optional(),
    habitaciones_min: z.number().optional()
  }).optional()
})

export async function POST(req){
  try{
    const body = await req.json()
    const { q, filtros } = QSchema.parse(body||{})
    const f = {
      distrito: filtros?.distrito?.toLowerCase()?.trim(),
      precio_max: filtros?.precio_max,
      area_min: filtros?.area_min,
      habitaciones_min: filtros?.habitaciones_min
    }

    let items = []
    try{ items = await loadListingsInline() } catch {}

    if((!items || !items.length) && (process.env.FEEDS_MODE === 'search')){
      const query = [
        q || '',
        f.distrito || '',
        f.habitaciones_min ? `${f.habitaciones_min}+ habitaciones` : '',
        f.area_min ? `${f.area_min}+ m2` : '',
        f.precio_max ? `hasta $${f.precio_max}` : '',
        'site:urbania.pe OR site:adondevivir.com OR site:babilonia.pe OR site:olx.com.pe OR site:properati.com.pe'
      ].filter(Boolean).join(' ')
      const results = await cseSearchInline(query)
      items = results.map(r=>({
        id:r.url, titulo:r.titulo, precio:undefined, moneda:'USD', m2:undefined,
        habitaciones:undefined, banos:undefined, estacionamientos:undefined,
        direccion:undefined, distrito:f.distrito, fuente:'cse', url:r.url,
        lat:undefined, lon:undefined, antiguedad:undefined, tipo:'departamento', area_terreno:undefined
      }))
    }

    const qNorm = (q || '').toLowerCase()
    items = items.filter(it=>{
      if (f.distrito && it.distrito && it.distrito !== f.distrito) return false
      if (f.precio_max && it.precio && it.precio > f.precio_max) return false
      if (f.area_min && it.m2 && it.m2 < f.area_min) return false
      if (f.habitaciones_min && it.habitaciones && it.habitaciones < f.habitaciones_min) return false
      if (qNorm){
        const blob = `${it.titulo||''} ${it.direccion||''} ${it.distrito||''}`.toLowerCase()
        if (!blob.includes(qNorm)) return false
      }
      return true
    })

    // geocode suave (hasta 12)
    let geocoded=0
    for (const it of items){
      if((!it.lat || !it.lon) && it.direccion && geocoded<12){
        const g = await geocodeInline(it.direccion, it.distrito)
        if (g){ it.lat=g.lat; it.lon=g.lon; geocoded++ }
      }
    }

    return new Response(JSON.stringify({ ok:true, items }), { status:200, headers:{'Content-Type':'application/json'} })
  }catch(e){
    return new Response(JSON.stringify({ ok:false, error: e.message || 'error' }), { status:200, headers:{'Content-Type':'application/json'} })
  }
}
