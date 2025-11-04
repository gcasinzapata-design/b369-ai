import fs from 'node:fs/promises'
import path from 'node:path'

async function loadMock(){ 
  const file = path.join(process.cwd(), 'public', 'mock.json')
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function geocode(addr){
  const base = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org'
  const url = `${base}/search?format=json&q=${encodeURIComponent(addr)}&limit=1`
  const r = await fetch(url, { headers: { 'User-Agent': 'b369-ai/1.0 (netlify)' } })
  if (!r.ok) return null
  const a = await r.json()
  if (!a?.length) return null
  return { lat: Number(a[0].lat), lon: Number(a[0].lon) }
}

function passFilters(r, f){
  if (f.distrito && !(r.direccion||'').toLowerCase().includes(f.distrito.toLowerCase())) return false
  if (f.minArea && (r.m2||0) < f.minArea) return false
  if (f.minHab && (r.habitaciones||0) < f.minHab) return false
  if (f.maxPrecio && (r.precio||0) > f.maxPrecio) return false
  return true
}

export async function POST(req){
  try{
    const body = await req.json().catch(()=>({}))
    const q = (body.q||'').toLowerCase()
    const minArea = Number(body.minArea||0)
    const minHab = Number(body.minHab||0)
    const maxPrecio = Number(body.maxPrecio||0)
    const distrito = body.distrito || (q.includes('miraflores')?'miraflores': q.includes('surco')?'surco': '')

    let items = await loadMock()
    items = items.filter(r=>passFilters(r, {distrito, minArea, minHab, maxPrecio}))

    // Geocode addresses for map pins (best effort)
    const withCoords = await Promise.all(items.map(async it => {
      if (it.lat && it.lon) return it
      const g = it.direccion ? await geocode(it.direccion) : null
      return g ? {...it, lat:g.lat, lon:g.lon} : it
    }))

    return new Response(JSON.stringify({ ok:true, items: withCoords }), { headers: { 'content-type':'application/json' } })
  }catch(e){
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'error' }), { status:500 })
  }
}
