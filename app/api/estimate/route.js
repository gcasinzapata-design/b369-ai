// app/api/estimate/route.js
import { NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'

// Si ya tienes scrapeAll en lib/scrape/providers, lo usamos cuando ENABLE_SCRAPING=true
let scrapeAll = null
try {
  const mod = await import('../../../lib/scrape/providers.js')
  scrapeAll = mod.scrapeAll
} catch {
  // sin scraping, caemos a mock local
}

const BodySchema = z.object({
  direccion: z.string().min(4),
  tipo: z.enum(['departamento','casa']),
  areaConstruida_m2: z.number().positive(),
  areaTerreno_m2: z.number().optional().default(0),
  antiguedad_anos: z.number().optional().default(0),
  vista_mar: z.boolean().optional().default(false),
  habitaciones: z.number().optional().default(0),
  banos: z.number().optional().default(0),
  estacionamientos: z.number().optional().default(0)
})

const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org'

// Cache simple en memoria (1h)
const geoCache = new Map()
function setCache(k, v){ geoCache.set(k, {v, ts:Date.now()}) }
function getCache(k){
  const e = geoCache.get(k)
  if(!e) return null
  if(Date.now() - e.ts > 3600_000){ geoCache.delete(k); return null }
  return e.v
}

async function geocode(address){
  const key = address.toLowerCase().trim()
  const cached = getCache(key)
  if (cached) return cached
  const url = `${NOMINATIM}?format=json&q=${encodeURIComponent(address)}&limit=1`
  try{
    const r = await fetch(url, {
      headers: { 'User-Agent': 'B369AI/1.0 (contact: admin@b369.ai)' }
    })
    if(!r.ok) return null
    const j = await r.json()
    if(Array.isArray(j) && j[0]){
      const { lat, lon, display_name } = j[0]
      const out = { lat:Number(lat), lon:Number(lon), name: display_name }
      setCache(key, out)
      return out
    }
  }catch(e){ console.warn('geocode fail', e?.message) }
  return null
}

function haversine(a,b){
  const R = 6371 // km
  const d2r = (x)=>x*Math.PI/180
  const dLat = d2r(b.lat-a.lat)
  const dLon = d2r(b.lon-a.lon)
  const s1 = Math.sin(dLat/2)**2
  const s2 = Math.cos(d2r(a.lat))*Math.cos(d2r(b.lat))*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.sqrt(s1+s2))
}

function median(arr){
  if(!arr.length) return 0
  const s = [...arr].sort((x,y)=>x-y)
  const i = Math.floor(s.length/2)
  return s.length%2 ? s[i] : (s[i-1]+s[i])/2
}

function percentile(arr, p){
  if(!arr.length) return 0
  const s = [...arr].sort((a,b)=>a-b)
  const idx = (s.length-1)*p
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return s[lo]
  return s[lo] + (s[hi]-s[lo])*(idx-lo)
}

async function loadCandidates({ q, enableScraping }){
  // 1) Scraping si está permitido
  if (enableScraping && typeof scrapeAll === 'function'){
    const out = await scrapeAll({ q, enable:true })
    return out || []
  }
  // 2) Fallback: lee mock.json
  const file = path.join(process.cwd(),'public','mock.json')
  try{
    const txt = await fs.readFile(file, 'utf8')
    const arr = JSON.parse(txt)
    return Array.isArray(arr) ? arr : []
  }catch{
    return []
  }
}

function normalizeItem(it){
  // Convertimos campos esperados
  const precio = Number(it.precio || it.price || 0)
  const m2 = Number(it.m2 || it.area || 0)
  return {
    id: it.id || crypto.randomUUID(),
    titulo: it.titulo || it.title || '',
    precio,
    moneda: it.moneda || it.currency || 'USD',
    m2,
    habitaciones: Number(it.habitaciones || it.rooms || 0),
    banos: Number(it.banos || it.baths || 0),
    estacionamientos: Number(it.estacionamientos || it.parking || 0),
    direccion: it.direccion || it.address || '',
    lat: it.lat ? Number(it.lat) : undefined,
    lon: it.lon ? Number(it.lon) : undefined,
    url: it.url || ''
  }
}

export async function POST(req){
  try{
    const body = await req.json().catch(()=> ({}))
    const input = BodySchema.parse(body)

    // Geocodifica el sujeto
    const g = await geocode(input.direccion)
    if(!g) return NextResponse.json({ ok:false, error:'No se pudo geocodificar la dirección' }, { status: 400 })
    const subject = { lat:g.lat, lon:g.lon }

    // Carga candidatos (scraping si habilitado, mock si no)
    const ENABLE_SCRAPING = process.env.ENABLE_SCRAPING === 'true'
    const raw = await loadCandidates({ q: input.direccion, enableScraping: ENABLE_SCRAPING })
    let items = raw.map(normalizeItem)

    // Geocodifica hasta 25 candidatos sin coords (para poder medir distancia)
    const needs = items.filter(x=>(!x.lat || !x.lon) && x.direccion).slice(0,25)
    await Promise.allSettled(needs.map(async (x)=>{
      const gg = await geocode(x.direccion)
      if(gg){ x.lat = gg.lat; x.lon = gg.lon }
    }))

    // Filtro: que tengan área y precio y coordenadas
    items = items.filter(x => x.m2>0 && x.precio>1000 && x.lat && x.lon)

    // Distancia al sujeto
    items.forEach(x => x.dist_km = haversine(subject, { lat:x.lat, lon:x.lon }))

    // Filtro por cercanía (<= 2 km) y similitud de área (±20% respecto a área construida)
    const area = input.areaConstruida_m2
    const MIN = area*0.8, MAX = area*1.2
    let comps = items.filter(x => x.dist_km <= 2 && x.m2 >= MIN && x.m2 <= MAX)

    // Si quedan pocos, ampliamos a 3 km y ±30%
    if (comps.length < 20){
      const MIN2 = area*0.7, MAX2 = area*1.3
      comps = items.filter(x => x.dist_km <= 3 && x.m2 >= MIN2 && x.m2 <= MAX2)
    }

    // Si aún son pocos, nos quedamos con los 60 más cercanos válidos
    if (comps.length < 20){
      comps = items.sort((a,b)=>a.dist_km - b.dist_km).slice(0,60)
    }

    // Calcula precio por m² y limpia outliers por IQR
    comps.forEach(x => x.ppm2 = x.precio / x.m2)
    const ppm2 = comps.map(x=>x.ppm2).filter(n=>isFinite(n) && n>0).sort((a,b)=>a-b)
    if(!ppm2.length) return NextResponse.json({ ok:false, error:'Sin comparables suficientes' }, { status: 404 })

    const p25 = percentile(ppm2, 0.25)
    const p75 = percentile(ppm2, 0.75)
    const iqr = p75 - p25
    const low = p25 - 1.5*iqr
    const high = p75 + 1.5*iqr
    comps = comps.filter(x => x.ppm2>=low && x.ppm2<=high)

    // Recalcular ppm2 limpio
    const ppm2Clean = comps.map(x=>x.ppm2).sort((a,b)=>a-b)
    const med = median(ppm2Clean)
    const p25c = percentile(ppm2Clean, 0.25)
    const p50c = percentile(ppm2Clean, 0.50)
    const p75c = percentile(ppm2Clean, 0.75)

    // Ajustes simples (penalizaciones/bonificaciones) respecto al sujeto
    let mult = 1.0
    if (input.tipo === 'casa' && input.areaTerreno_m2 > 0) mult += 0.03
    if (input.vista_mar) mult += 0.05
    if (input.antiguedad_anos > 25) mult -= 0.08
    if (input.antiguedad_anos < 5) mult += 0.03
    // Amenidades (muy simple, podrías refinar con regresión)
    mult += Math.min(0.02 * Math.max(0, (input.habitaciones||0) - median(comps.map(c=>c.habitaciones||0))), 0.06)
    mult += Math.min(0.02 * Math.max(0, (input.banos||0) - median(comps.map(c=>c.banos||0))), 0.06)
    mult += Math.min(0.015 * Math.max(0, (input.estacionamientos||0) - median(comps.map(c=>c.estacionamientos||0))), 0.045)

    const precio_m2_zona = Math.round(med)
    const estimado = Math.round(precio_m2_zona * input.areaConstruida_m2 * mult)
    const rango = Math.round(estimado * 0.08)

    // Ordena por cercanía y toma hasta 40 comparables
    comps.sort((a,b)=>a.dist_km - b.dist_km)
    const top = comps.slice(0, 40).map(c => ({
      titulo: c.titulo, direccion: c.direccion, url: c.url || '',
      m2: Math.round(c.m2), precio: Math.round(c.precio)
    }))

    return NextResponse.json({
      ok: true,
      estimado,
      rango_confianza: [estimado - rango, estimado + rango],
      precio_m2_zona,
      percentiles: { p25: Math.round(p25c), p50: Math.round(p50c), p75: Math.round(p75c) },
      comparables: top
    })
  }catch(e){
    console.error('Estimate API error', e)
    return NextResponse.json({ ok:false, error:String(e?.message || e) }, { status: 500 })
  }
}
