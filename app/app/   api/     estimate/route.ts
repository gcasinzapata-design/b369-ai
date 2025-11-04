// app/api/estimate/route.ts
import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

type Input = {
  direccion: string
  tipo: 'departamento' | 'casa'
  area_m2: number
  antiguedad_anos?: number
  vista_mar?: boolean
  habitaciones?: number
  banos?: number
  estacionamientos?: number
}

type Comparable = {
  precio: number
  m2: number
  titulo?: string
  direccion?: string
}

function median(arr: number[]) {
  if (!arr.length) return 2000
  const s = [...arr].sort((a, b) => a - b)
  const i = Math.floor(s.length / 2)
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2
}

async function loadComparables(): Promise<Comparable[]> {
  const file = path.join(process.cwd(), 'public', 'mock.json')
  const raw = await fs.readFile(file, 'utf8')
  const data = JSON.parse(raw) as Comparable[]
  return data
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Input
    const comps = await loadComparables()

    // precio m2 de la "zona" a partir del mock (en real: filtrar por distrito/geohash)
    const precioM2Zona = Math.round(
      median(
        comps
          .filter(c => c.m2 > 0)
          .map(c => c.precio / c.m2)
      )
    )

    // multiplicadores simples
    let mult = 1.0
    if (body.tipo === 'casa') mult += 0.05
    if (body.vista_mar) mult += 0.10
    const antig = body.antiguedad_anos ?? 0
    if (antig > 25) mult -= 0.10
    if (antig > 0 && antig < 5) mult += 0.05

    const hab = body.habitaciones ?? 0
    if (hab >= 3) mult += 0.03
    if (hab >= 4) mult += 0.02

    const banos = body.banos ?? 0
    if (banos >= 2) mult += 0.02
    if (banos >= 3) mult += 0.02

    const est = body.estacionamientos ?? 0
    if (est >= 1) mult += 0.02
    if (est >= 2) mult += 0.02

    const m2 = Math.max(1, body.area_m2 || 80)
    const estimado = Math.round(precioM2Zona * m2 * mult)
    const rango = Math.round(estimado * 0.08)

    return NextResponse.json({
      ok: true,
      estimado,
      rango_confianza: [estimado - rango, estimado + rango],
      precio_m2_zona: precioM2Zona,
      comparables: comps.slice(0, 5),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function GET() {
  // demo GET para probar rápido desde el navegador
  return NextResponse.json({ ok: true, ping: 'estimate alive' })
}
