// app/api/estimate/route.js
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { geocodeAddress, distMeters } from '../../../lib/geo.js'

const BodySchema = z.object({
  direccion: z.string().min(3),
  district: z.string().optional(),
  tipo: z.enum(['departamento','casa']).default('departamento'),
  areaConstruida_m2: z.number().int().positive(),
  areaTerreno_m2: z.number().int().nonnegative().optional(),
  antiguedad_anos: z.number().int().nonnegative().optional(),
  vista_mar: z.boolean().optional(),
  habitaciones: z.number().int().nonnegative().optional(),
  banos: z.number().int().nonnegative().optional(),
  estacionamientos: z.number().int().nonnegative().optional(),
  maxKm: z.number().optional().default(2),
  minComps: z.number().optional().default(40)
})

function percentile(arr, p) {
  if (!arr.length) return 0
  const s = [...arr].sort((a,b)=>a-b)
  const idx = Math.min(s.length-1, Math.max(0, Math.round((p/100)*(s.length-1))))
  return s[idx]
}
function dedupe(arr) {
  const seen = new Set(), out=[]
  for (const x of arr) {
    const key = x.url || x.id || (x.titulo||'')+(x.m2||'')
    if (seen.has(key)) continue; seen.add(key); out.push(x)
  }
  return out
}

export async function POST(req) {
  try {
    const origin = req.nextUrl?.origin || ''
    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok:false, error:'invalid_body', issues: parsed.error.issues }, { status: 400 })
    }
    const {
      direccion, district, tipo,
      areaConstruida_m2, areaTerreno_m2=0, antiguedad_anos=0, vista_mar=false,
      habitaciones=0, banos=0, estacionamientos=0,
      maxKm, minComps
    } = parsed.data

    const geo = await geocodeAddress(direccion, district || '')
    if (!geo) {
      return NextResponse.json({ ok:false, error:'no_geocode', note:'Intenta “Av Precursores 537, Santiago de Surco, Lima, Perú”.' }, { status: 400 })
    }

    let comps = []
    let km = Math.max(1.0, maxKm)
    for (let attempt=0; attempt<5 && comps.length<minComps; attempt++) {
      const res = await fetch(`${origin}/api/search`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          q: `${tipo} ${district||''}`,
          district,
          minArea: Math.max(30, Math.round(areaConstruida_m2 * 0.65)), // más laxo
          minRooms: habitaciones || 0,
          maxPrice: 0,
          limit: 120
        })
      }).catch(()=>null)

      const data = res && res.ok ? await res.json() : { ok:false, items:[] }
      const raw = data.ok && Array.isArray(data.items) ? data.items : []

      const withDist = raw.map(r => ({
        ...r,
        __dist: (r.lat && r.lon) ? distMeters(geo, { lat:r.lat, lon:r.lon }) : Infinity
      })).filter(r => r.__dist <= km*1000)

      comps = dedupe(withDist)
      if (comps.length < minComps) km = km * 1.9
    }

    if (comps.length < 8) {
      return NextResponse.json({
        ok:true, estimado:0, rango_confianza:[0,0], precio_m2_zona:0,
        p25:0, p50:0, p75:0,
        comparables: [],
        note:'Sin comparables suficientes cercanos (baja filtros o prueba distrito contiguo).'
      })
    }

    const pm2 = comps.map(c => (c.precio && c.m2) ? c.precio / c.m2 : 0).filter(x => x>0)
    const p25 = percentile(pm2, 25), p50 = percentile(pm2, 50), p75 = percentile(pm2, 75)

    let mult = 1
    if (tipo === 'casa' && areaTerreno_m2 > areaConstruida_m2) mult += 0.03
    if (vista_mar) mult += 0.07
    if (antiguedad_anos > 30) mult -= 0.08
    if (antiguedad_anos < 5) mult += 0.04
    if (estacionamientos >= 2) mult += 0.02

    const base = p50 * areaConstruida_m2
    const estimado = Math.round(base * mult)
    const lo = Math.round(p25 * areaConstruida_m2 * mult)
    const hi = Math.round(p75 * areaConstruida_m2 * mult)

    const top = comps.sort((a,b)=>a.__dist-b.__dist).slice(0, 40).map(({__dist,...rest})=>rest)

    return NextResponse.json({
      ok:true,
      estimado,
      rango_confianza:[lo,hi],
      precio_m2_zona: Math.round(p50),
      p25: Math.round(p25),
      p50: Math.round(p50),
      p75: Math.round(p75),
      comparables: top
    })
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status: 500 })
  }
}
