// app/api/estimate/route.js
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { geocodeAddress, distMeters } from '../../../lib/geo'

const BodySchema = z.object({
  direccion: z.string().min(3),
  district: z.string().optional(),
  tipo: z.enum(['departamento','casa']).default('departamento'),
  areaConstruida_m2: z.number().int().positive(), // OBLIGATORIO
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

export async function POST(req) {
  try {
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

    // Geocodificar inmueble objetivo
    const geo = await geocodeAddress(direccion, district || '')
    if (!geo) {
      return NextResponse.json({ ok:false, error:'no_geocode' }, { status: 400 })
    }

    // Buscar comparables usando /api/search internamente con expansión de radio/distrito
    // Como /api/search devuelve lat/lon aproximados, pedimos más y filtramos por distancia
    let comps = []
    let km = Math.max(0.8, maxKm) // arranca con 0.8km ~ 800m
    for (let attempt=0; attempt<4 && comps.length<minComps; attempt++) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          q: [tipo, district || ''].join(' '),
          district,
          minArea: Math.max(30, Math.round(areaConstruida_m2 * 0.7)),
          minRooms: habitaciones || 0,
          maxPrice: 0,
          limit: 120
        })
      }).catch(()=>null)

      const data = res && res.ok ? await res.json() : { ok:false, items:[] }
      const raw = data.ok && Array.isArray(data.items) ? data.items : []

      // filtra por distancia si tienen coords
      const withDist = raw.map(r => ({
        ...r,
        __dist: (r.lat && r.lon) ? distMeters(geo, { lat:r.lat, lon:r.lon }) : Infinity
      })).filter(r => r.__dist <= km*1000)

      comps = dedupeByIdOrURL(withDist)
      if (comps.length < minComps) km *= 1.8
    }

    if (comps.length < 8) {
      return NextResponse.json({ ok:true, estimado:0, rango_confianza:[0,0], precio_m2_zona:0, comparables: [], note:'Sin comparables suficientes' })
    }

    // precio/m2 comparables (usar m2; si viene 0, descartar)
    const pm2 = comps.map(c => (c.precio && c.m2) ? c.precio / c.m2 : 0).filter(x => x>0)
    if (!pm2.length) {
      return NextResponse.json({ ok:true, estimado:0, rango_confianza:[0,0], precio_m2_zona:0, comparables: [], note:'Comparables sin m2 válido' })
    }

    const p25 = percentile(pm2, 25)
    const p50 = percentile(pm2, 50) // mediana
    const p75 = percentile(pm2, 75)

    // Ajustes simples por características
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

    // recorta top comparables
    const top = comps
      .sort((a,b)=>a.__dist-b.__dist)
      .slice(0, 40)
      .map(({__dist, ...rest}) => rest)

    return NextResponse.json({
      ok:true,
      estimado,
      rango_confianza: [lo, hi],
      precio_m2_zona: Math.round(p50),
      comparables: top
    })
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status: 500 })
  }
}

function dedupeByIdOrURL(arr) {
  const seen = new Set()
  const out = []
  for (const x of arr) {
    const key = x.id || x.url || JSON.stringify(x).slice(0,80)
    if (seen.has(key)) continue
    seen.add(key); out.push(x)
  }
  return out
}
