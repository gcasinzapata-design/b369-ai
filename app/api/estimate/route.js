// app/api/estimate/route.js
import fs from 'node:fs/promises'
import path from 'node:path'

function median(arr) {
  if (!arr.length) return 2000
  const s = [...arr].sort((a, b) => a - b)
  const i = Math.floor(s.length / 2)
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2
}

async function loadComparables() {
  const file = path.join(process.cwd(), 'public', 'mock.json')
  const raw = await fs.readFile(file, 'utf8')
  return JSON.parse(raw)
}

export async function POST(req) {
  try {
    const body = await req.json()

    // valores mínimos/por defecto
    const tipo = body?.tipo === 'casa' ? 'casa' : 'departamento'
    const area_m2 = Math.max(1, Number(body?.area_m2 || 80))
    const antiguedad_anos = Number(body?.antiguedad_anos || 0)
    const vista_mar = Boolean(body?.vista_mar)
    const habitaciones = Number(body?.habitaciones || 0)
    const banos = Number(body?.banos || 0)
    const estacionamientos = Number(body?.estacionamientos || 0)

    const comps = await loadComparables()
    const precioM2Zona = Math.round(
      median(
        comps.filter(c => (c.m2 || 0) > 0).map(c => c.precio / c.m2)
      )
    )

    // multiplicadores simples por atributos
    let mult = 1.0
    if (tipo === 'casa') mult += 0.05
    if (vista_mar) mult += 0.10
    if (antiguedad_anos > 25) mult -= 0.10
    if (antiguedad_anos > 0 && antiguedad_anos < 5) mult += 0.05

    if (habitaciones >= 3) mult += 0.03
    if (habitaciones >= 4) mult += 0.02

    if (banos >= 2) mult += 0.02
    if (banos >= 3) mult += 0.02

    if (estacionamientos >= 1) mult += 0.02
    if (estacionamientos >= 2) mult += 0.02

    const estimado = Math.round(precioM2Zona * area_m2 * mult)
    const rango = Math.round(estimado * 0.08)

    return new Response(JSON.stringify({
      ok: true,
      estimado,
      rango_confianza: [estimado - rango, estimado + rango],
      precio_m2_zona: precioM2Zona,
      comparables: comps.slice(0, 5)
    }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'error' }), { status: 500 })
  }
}

export async function GET() {
  // ping simple para prueba rápida
  return new Response(JSON.stringify({ ok: true, ping: 'estimate alive' }), {
    headers: { 'content-type': 'application/json' }
  })
}
