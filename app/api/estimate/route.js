// app/api/estimate/route.js
import { NextResponse } from 'next/server'
import { scrapeAll } from '../../../lib/scrape/providers.js'

function percentile(arr, p) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const idx = Math.floor((p / 100) * (s.length - 1))
  return s[idx]
}

async function geocode(address) {
  const base = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org'
  const url = `${base}/search?format=json&q=${encodeURIComponent(address)}&limit=1`
  const r = await fetch(url, { headers: { 'User-Agent': 'B369AI/1.0 (contact: admin@b369.ai)' } })
  if (!r.ok) return null
  const j = await r.json()
  if (!Array.isArray(j) || !j[0]) return null
  const { lat, lon, display_name } = j[0]
  return { lat: Number(lat), lon: Number(lon), display_name }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const {
      direccion,
      tipo,
      area_m2,
      antiguedad_anos,
      vista_mar,
      habitaciones,
      banos,
      estacionamientos
    } = body || {}

    if (!direccion || !area_m2 || !tipo) {
      return NextResponse.json({ ok: false, error: 'Faltan campos obligatorios (direccion, area_m2, tipo)' }, { status: 400 })
    }

    const geo = await geocode(direccion).catch(() => null)
    const districtHint = geo?.display_name?.split(',')?.[1]?.trim() || ''

    const ENABLE_SCRAPING = process.env.ENABLE_SCRAPING === 'true'

    // Construimos una query “suave” usando pista del distrito y tipo + área
    const q = `${tipo} ${districtHint} ${Math.max(40, Math.min(200, Number(area_m2)))}m2`
    const comps = await scrapeAll({
      q,
      minArea: Math.max(30, Number(area_m2) * 0.7),
      minRooms: habitaciones || 1,
      district: districtHint || undefined,
      maxPrice: undefined,
      enable: ENABLE_SCRAPING
    })

    // Normalizamos comparables por proximidad a área y filtros simples
    const filtered = comps
      .filter(c => c.m2 && c.precio && c.m2 > 0)
      .filter(c => !habitaciones || (c.habitaciones || 0) >= habitaciones)
      .filter(c => !banos || (c.banos || 0) >= banos)

    // Orden por |m2 - área_m2|
    filtered.sort((a, b) => Math.abs(a.m2 - area_m2) - Math.abs(b.m2 - area_m2))

    const top = filtered.slice(0, 40)
    const pm2 = top.map(c => c.precio / c.m2).filter(n => Number.isFinite(n))
    if (!pm2.length) {
      return NextResponse.json({ ok: false, error: 'No se hallaron comparables suficientes' }, { status: 404 })
    }

    const p25 = percentile(pm2, 25)
    const p50 = percentile(pm2, 50)
    const p75 = percentile(pm2, 75)

    // Ajustes, muy básicos (mejorables con modelo)
    let mult = 1.0
    if (tipo === 'casa') mult += 0.04
    if (vista_mar) mult += 0.08
    if (antiguedad_anos > 25) mult -= 0.08
    if (antiguedad_anos < 5) mult += 0.03
    if (estacionamientos >= 2) mult += 0.02

    const precio_m2_zona = Math.round(p50)
    const estimado = Math.round(precio_m2_zona * Number(area_m2) * mult)
    const rango = Math.round(estimado * 0.1)

    return NextResponse.json({
      ok: true,
      estimado,
      rango_confianza: [estimado - rango, estimado + rango],
      precio_m2_zona,
      comparables: top.map(c => ({ titulo: c.titulo, direccion: c.direccion, m2: c.m2, precio: c.precio, url: c.url, fuente: c.fuente }))
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
