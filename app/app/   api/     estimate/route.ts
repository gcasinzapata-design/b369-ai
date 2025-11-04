// app/api/estimate/route.ts
import { NextResponse } from 'next/server'

type Comp = {
  id: string; titulo: string; precio: number; moneda: string; m2: number; habitaciones: number;
  banos?: number; estacionamientos?: number; direccion?: string
}

const FALLBACK: Comp[] = [
  { id:'1', titulo:'Depto vista mar - Miraflores', precio:210000, moneda:'USD', m2:78, habitaciones:2, banos:2, estacionamientos:1, direccion:'Miraflores' },
  { id:'2', titulo:'Flat parque - Miraflores', precio:185000, moneda:'USD', m2:70, habitaciones:2, banos:2, estacionamientos:0, direccion:'Miraflores' },
  { id:'3', titulo:'Casa jardín - Surco', precio:360000, moneda:'USD', m2:160, habitaciones:4, banos:3, estacionamientos:2, direccion:'Surco' }
]

function median(nums: number[]) {
  const s = [...nums].sort((a,b)=>a-b)
  const n = s.length
  if (!n) return 0
  return n % 2 ? s[(n-1)/2] : (s[n/2 - 1] + s[n/2]) / 2
}

async function loadData(baseUrl: string): Promise<Comp[]> {
  try {
    const res = await fetch(new URL('/mock.json', baseUrl), { cache: 'no-store' })
    if (!res.ok) throw new Error('mock.json not ok')
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('mock.json invalid')
    return data as Comp[]
  } catch {
    return FALLBACK
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({}))

  const {
    direccion = '',
    tipo = 'departamento',
    area_m2 = 80,
    antiguedad_anos = 10,
    vista_mar = false,
    habitaciones = 2,
    banos = 2,
    estacionamientos = 1
  } = body

  const base = new URL(req.url).origin + '/'
  const comps = await loadData(base)

  // Filtrar comps por “zona” si aparece el distrito en dirección/título
  const key = (direccion as string).toLowerCase()
  const filtered = comps.filter(c => {
    const t = (c.titulo || '').toLowerCase()
    const d = (c.direccion || '').toLowerCase()
    // si menciona Miraflores/Surco/etc, lo consideramos comparable
    if (!key) return true
    return t.includes(key) || d.includes(key) ||
           (key.includes('miraflores') && (t.includes('miraflores') || d.includes('miraflores'))) ||
           (key.includes('surco') && (t.includes('surco') || d.includes('surco'))) ||
           (key.includes('san isidro') && (t.includes('san isidro') || d.includes('san isidro'))) ||
           (key.includes('barranco') && (t.includes('barranco') || d.includes('barranco')))
  })

  const pool = filtered.length ? filtered : comps
  const m2s = pool.map(c => c.precio / Math.max(1, c.m2))
  let precio_m2 = Math.round(median(m2s))

  // Multiplicadores simples
  let mult = 1.0
  if (tipo === 'casa') mult += 0.05
  if (vista_mar) mult += 0.10
  if (antiguedad_anos > 25) mult -= 0.10
  if (antiguedad_anos < 5) mult += 0.05

  // Ajustes por ambientes (muy básicos para demo)
  if (habitaciones >= 3) mult += 0.03
  if (banos >= 2) mult += 0.02
  if ((estacionamientos ?? 0) >= 1) mult += 0.02

  const estimado = Math.max(1, Math.round(precio_m2 * Number(area_m2) * mult))
  const rango = Math.round(estimado * 0.08)

  return NextResponse.json({
    ok: true,
    input: { direccion, tipo, area_m2, antiguedad_anos, vista_mar, habitaciones, banos, estacionamientos },
    precio_m2_base: precio_m2,
    multiplicador: mult,
    estimado,
    rango_confianza: [estimado - rango, estimado + rango],
    comparables: pool.slice(0, 5)
  })
}
