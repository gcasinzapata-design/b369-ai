// app/api/search/route.ts
import { NextResponse } from 'next/server'

type Item = {
  id: string
  titulo: string
  precio: number
  moneda: string
  m2: number
  habitaciones: number
  banos?: number
  estacionamientos?: number
  direccion?: string
  fuente?: string
  url?: string
}

function parseQuery(q: string) {
  const text = (q || '').toLowerCase()
  // distritos simples (amplía según necesites)
  const distritos = ['miraflores','surco','san isidro','barranco','magdalena','san borja','la molina']
  const distrito = distritos.find(d => text.includes(d)) || undefined

  // precio: máximo $ o S/
  const priceUsd = /(?:\$|usd)\s?([\d.,]+)/i.exec(q || '')
  const pricePen = /(?:s\/|pen)\s?([\d.,]+)/i.exec(q || '')
  const maxPrice = priceUsd ? { value: Number(priceUsd[1].replace(/[.,]/g, '')), currency: 'USD' }
                 : pricePen ? { value: Number(pricePen[1].replace(/[.,]/g, '')), currency: 'PEN' }
                 : undefined

  // habitaciones / baños
  const hab = /(\d+)\s*(hab|habitaciones?)/i.exec(q || '')
  const ban = /(\d+)\s*(bañ|ban|baños?)/i.exec(q || '')

  // tipo
  const tipo = text.includes('casa') ? 'casa' : (text.includes('depa') || text.includes('departamento')) ? 'departamento' : undefined

  return {
    distrito,
    maxPrice,
    habitaciones: hab ? Number(hab[1]) : undefined,
    banos: ban ? Number(ban[1]) : undefined,
    tipo
  }
}

function matches(it: Item, f: any) {
  // distrito dentro de dirección o título
  if (f.distrito) {
    const inDir = (it.direccion || '').toLowerCase().includes(f.distrito)
    const inTit = (it.titulo || '').toLowerCase().includes(f.distrito)
    if (!inDir && !inTit) return false
  }
  if (f.tipo) {
    const tit = (it.titulo || '').toLowerCase()
    if (f.tipo === 'casa' && !tit.includes('casa')) return false
    if (f.tipo === 'departamento' && tit.includes('casa')) return false
  }
  if (f.habitaciones && (it.habitaciones ?? 0) < f.habitaciones) return false
  if (f.banos && (it.banos ?? 0) < f.banos) return false

  if (f.maxPrice) {
    if (f.maxPrice.currency === 'USD') {
      if (it.moneda !== 'USD') return false
      if (it.precio > f.maxPrice.value) return false
    } else {
      if (it.moneda === 'USD') return false // simplificación demo
      if (it.precio > f.maxPrice.value) return false
    }
  }
  // filtros numéricos exactos si vienen por query
  if (f.min_m2 && it.m2 < f.min_m2) return false
  if (f.max_m2 && it.m2 > f.max_m2) return false
  return true
}

export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({}))
  const q = body.q || ''
  const filters = body.filters || {}

  // Cargar “base” de demo
  const base = new URL(req.url)
  const items: Item[] = await (await fetch(new URL('/mock.json', base))).json()

  // Interpretar lenguaje natural + mezclar con filtros del panel
  const fromQ = parseQuery(q)
  const merged = { ...fromQ, ...filters }

  // Filtrar
  const out = items.filter((it)=>matches(it, merged))

  // Orden simple: precio asc
  out.sort((a,b)=>a.precio - b.precio)

  return NextResponse.json({ ok: true, count: out.length, items: out, applied: merged })
}
