// app/api/search/route.js
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { extractFiltersFromText, normalizeNumberLike } from '../../../lib/normalize.js'
import { geocodeAddress } from '../../../lib/geo.js'
import { searchUrbania, searchAdondevivir, searchBabilonia, searchOLX, searchProperati } from '../../../lib/scrape/providers.js'

const ENABLE_SCRAPING = process.env.ENABLE_SCRAPING === '1'
const g = globalThis
if (!g.__searchCache) g.__searchCache = new Map()

const BodySchema = z.object({
  q: z.string().optional(),
  district: z.string().optional(),
  minArea: z.union([z.number(), z.string()]).optional(),
  minRooms: z.union([z.number(), z.string()]).optional(),
  maxPrice: z.union([z.number(), z.string()]).optional(),
  tipo: z.string().optional(),
  limit: z.number().int().min(1).max(120).default(50)
})

async function runAll(params){
  const results = await Promise.allSettled([
    searchUrbania(params),
    searchAdondevivir(params),
    searchBabilonia(params),
    searchOLX(params),
    searchProperati(params),
  ])
  let items = []
  for (const r of results) if (r.status==='fulfilled' && Array.isArray(r.value)) items.push(...r.value)
  return items
}

export async function POST(req) {
  try {
    const body = await req.json().catch(()=>({}))
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok:false, error:'invalid_body', issues: parsed.error.issues }, { status: 400 })

    let { q='', district, minArea=0, minRooms=0, maxPrice=0, tipo, limit } = parsed.data
    // normaliza desde texto libre
    if (q) {
      const ex = extractFiltersFromText(q)
      district ||= ex.district || undefined
      tipo ||= ex.tipo || undefined
      maxPrice ||= ex.maxPrice || 0
      minRooms ||= ex.minRooms || 0
      minArea ||= ex.minArea || 0
    }
    minArea = typeof minArea==='string' ? normalizeNumberLike(minArea) : (minArea||0)
    minRooms = typeof minRooms==='string' ? normalizeNumberLike(minRooms) : (minRooms||0)
    maxPrice = typeof maxPrice==='string' ? normalizeNumberLike(maxPrice) : (maxPrice||0)

    const key = JSON.stringify({ q, district, minArea, minRooms, maxPrice, tipo, limit })
    if (g.__searchCache.has(key)) return NextResponse.json({ ok:true, items: g.__searchCache.get(key), note:'cache' })

    if (!ENABLE_SCRAPING){
      return NextResponse.json({ ok:false, error:'scraping_disabled', hint:'Set ENABLE_SCRAPING=1' }, { status: 503 })
    }

    // 1ª pasada: filtros tal cual
    let items = await runAll({ q, district, minRooms, minArea, maxPrice, limit })
    // Fallback si 0: baja minArea y sube limit
    let note
    if (!items.length) {
      const relaxed = { q, district, minRooms: Math.max(1, minRooms-1), minArea: Math.max(30, Math.round((minArea||60)*0.7)), maxPrice, limit: Math.min(120, limit*2) }
      items = await runAll(relaxed)
      note = 'fallback_filters_applied'
    }

    // geocodifica faltantes (máx 50 para no exceder rate limits)
    let geos = 0
    for (const it of items) {
      if (geos>=50) break
      if (!it.lat && !it.lon && it.direccion) {
        const geo = await geocodeAddress(it.direccion, district || '')
        if (geo){ it.lat = geo.lat; it.lon = geo.lon; geos++ }
      }
    }

    items = items.slice(0, limit)
    g.__searchCache.set(key, items)
    return NextResponse.json({ ok:true, items, note })
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status: 500 })
  }
}
