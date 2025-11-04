// app/api/search/route.ts
import { NextResponse } from 'next/server'

type Item = {
  id: string; titulo: string; precio: number; moneda: string; m2: number; habitaciones: number;
  banos?: number; estacionamientos?: number; direccion?: string; fuente?: string; url?: string
}

// Fallback embebido por si /public/mock.json no carga
const FALLBACK: Item[] = [
  { id:'1', titulo:'Departamento vista al mar - Miraflores', precio:210000, moneda:'USD', m2:78, habitaciones:2, banos:2, estacionamientos:1, direccion:'Malecón 28 de Julio, Miraflores', fuente:'fallback', url:'https://example.com/a' },
  { id:'2', titulo:'Flat remodelado cerca al parque - Miraflores', precio:185000, moneda:'USD', m2:70, habitaciones:2, banos:2, estacionamientos:0, direccion:'Av. La Paz, Miraflores', fuente:'fallback', url:'https://example.com/b' },
  { id:'3', titulo:'Casa amplia con jardín - Surco', precio:360000, moneda:'USD', m2:160, habitaciones:4, banos:3, estacionamientos:2, direccion:'Jr. Santa Rosa, Surco', fuente:'fallback', url:'https://example.com/c' }
]

function parseQuery(q: string) {
  const text = (q || '').toLowerCase()
  const distritos = ['miraflores','surco','san isidro','barranco','magdalena','san borja','la molina']
  const distrito = distritos.find(d => text.includes(d))

  const priceUsd = /(?:\$|usd)\s?([\d.,]+)/i.exec(q || '')
  const pricePen = /(?:s\/|pen)\s?([\d.,]+)/i.exec(q || '')
  const maxPrice = priceUsd ? { value: Number(priceUsd[1].replace(/[.,]/g, '')), currency: 'USD' }
                 : pricePen ? { value: Number(pricePen[1].replace(/[.,]/g, '')), currency: 'PEN' }
                 : undefined

  const hab = /(\d+)\s*(hab|habitaciones?)/i.exec(q || '')
  const ban = /(\d+)\s*(bañ|ban|baños?)/i.exec(q || '')
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
      if (it.moneda === 'USD') return false
      if (it.precio > f.maxPrice.value) return false
    }
  }
  if (f.min_m2 && it.m2 < f.min_m2) return false
  if (f.max_m2 && it.m2 > f.max_m2) return false
  return true
}

async function loadData(baseUrl: string): Promise<Item[]> {
  try {
    const res = await fetch(new URL('/mock.json', baseUrl), { cache: 'no-store' })
    if (!res.ok) throw new Error('mock.json not ok')
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('mock.json invalid')
    return data as Item[]
  } catch {
    return FALLBACK
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({}))
  const q = body.q || ''
  const filters = body.filters || {}

  const base = new URL(req.url).origin + '/'
  const items = await loadData(base)

  const fromQ = parseQuery(q)
  const merged = { ...fromQ, ...filters }
  const out = items.filter((it)=>matches(it, merged)).sort((a,b)=>a.precio - b.precio)

  return NextResponse.json({ ok: true, count: out.length, items: out, applied: merged })
}
