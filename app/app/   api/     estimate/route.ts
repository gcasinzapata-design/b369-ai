// app/api/estimate/route.ts
import { NextResponse } from 'next/server'

type Comparable = { id: string; titulo: string; precio: number; m2: number }

function median(arr: number[]){
  const s=[...arr].sort((a,b)=>a-b)
  const i=Math.floor(s.length/2)
  return s.length? (s.length%2? s[i] : (s[i-1]+s[i])/2) : 2000
}

export async function POST(req: Request){
  // Leer el body con datos del inmueble
  const body = await req.json().catch(()=> ({}))
  const {
    direccion='Miraflores',
    tipo='departamento',            // 'departamento' | 'casa'
    area_m2=80,
    habitaciones=2,
    antiguedad_anos=10,
    vista_mar=false,
    banos=1,
    estacionamientos=0
  } = body || {}

  // Cargar comparables de /public/mock.json (para demo)
  const base = new URL(req.url)
  const comps: Comparable[] = await (await fetch(new URL('/mock.json', base))).json()

  // Precio m² de la zona (mediana)
  const precio_m2_zona = Math.round(
    median(comps.map(c => c.precio / Math.max(1, c.m2)))
  )

  // Multiplicadores sencillos (demo)
  let mult = 1.0
  if (tipo === 'casa') mult += 0.05
  if (vista_mar) mult += 0.10
  if ((antiguedad_anos||0) > 25) mult -= 0.10
  else if ((antiguedad_anos||0) < 5) mult += 0.05
  if (habitaciones >= 4) mult += 0.04
  else if (habitaciones >= 3) mult += 0.02
  if (banos > 1) mult += Math.min(0.09, 0.03 * (banos - 1))
  if (estacionamientos > 0) mult += Math.min(0.06, 0.02 * estacionamientos)

  const estimado = Math.round(precio_m2_zona * (area_m2||80) * mult)
  const rango = Math.round(estimado * 0.08)

  return NextResponse.json({
    ok: true,
    input: { direccion, tipo, area_m2, habitaciones, antiguedad_anos, vista_mar, banos, estacionamientos },
    precio_m2_zona,
    estimado,
    rango_confianza: [estimado - rango, estimado + rango],
    comparables: comps.slice(0,5)
  })
}
