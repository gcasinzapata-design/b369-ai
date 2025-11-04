// app/api/search/route.js
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { extractFiltersFromText, normalizeNumberLike } from '../../../lib/normalize.js'
import { geocodeAddress } from '../../../lib/geo.js'
import { searchUrbania, searchAdondevivir, searchBabilonia, searchOLX, searchProperati } from '../../../lib/scrape/providers.js'

const ENABLE_SCRAPING = process.env.ENABLE_SCRAPING === '1'

const BodySchema = z.object({
  q: z.string().optional(),
  district: z.string().optional(),
  minArea: z.union([z.number(), z.string()]).optional(),
  minRooms: z.union([z.number(), z.string()]).optional(),
  maxPrice: z.union([z.number(), z.string()]).optional(),
  tipo: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(40)
})

const g = globalThis
if (!g.__searchCache) g.__searchCache = new Map()

export async function POST(req) {
  try {
    const body = await req.json().catch(()=>({}))
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok:false, error:'invalid_body', issues: parsed.error.issues }, { status: 400 })
    }
    let { q='', district, minArea=0, minRooms=0, maxPrice=0, tipo, limit } = parsed.data

    // normaliza numéricos si vinieron como string
    minArea = typeof minArea === 'string' ? normalizeNumberLike(minArea) : (minArea||0)
    minRooms = typeof minRooms === 'string' ? normalizeNumberLike(minRooms) : (minRooms||0)
    maxPrice = typeof maxPrice === 'string' ? normalizeNumberLike(maxPrice) : (maxPrice||0)

    if (q) {
      const ex = extractFiltersFromText(q)
      district ||= ex.district || undefined
      tipo ||= ex.tipo || undefined
      maxPrice ||= ex.maxPrice || 0
      minRooms ||= ex.minRooms || 0
      minArea ||= ex.minArea || 0
    }

    const cacheKey = JSON.stringify({ q, district, minArea, minRooms, maxPrice, tipo, limit })
    if (g.__searchCache.has(cacheKey)) {
      return NextResponse.json({ ok:true, items: g.__searchCache.get(cacheKey) })
    }

    if (!ENABLE_SCRAPING) {
      return NextResponse.json({ ok:false, error:'scraping_disabled', hint:'Set ENABLE_SCRAPING=1 en Netlify' }, { status: 503 })
    }

    // PRIORIDAD pedida
    const results = await Promise.allSettled([
      searchUrbania({ q, district, minRooms, minArea, maxPrice, limit }),
      searchAdondevivir({ q, district, minRooms, minArea, maxPrice, limit }),
      searchBabilonia({ q, district, minRooms, minArea, maxPrice, limit }),
      searchOLX({ q, district, minRooms, minArea, maxPrice, limit }),
      searchProperati({ q, district, minRooms, minArea, maxPrice, limit }),
    ])

    let items = []
    for (const r of results) if (r.status === 'fulfilled') items.push(...r.value)

    // Filtra y geocodifica
    items = items.filter(it=>{
      if (minArea && it.m2 && it.m2 < minArea) return false
      if (minRooms && typeof it.habitaciones==='number' && it.habitaciones < minRooms) return false
      if (maxPrice && it.precio && it.precio > maxPrice) return false
      if (tipo && it.titulo && !it.titulo.toLowerCase().includes(tipo)) return false
      return true
    })

    // geocodifica faltantes
    for (const it of items.slice(0, limit)) {
      if ((it.lat && it.lon) || !it.direccion) continue
      const geo = await geocodeAddress(it.direccion, district || '')
      if (geo) { it.lat = geo.lat; it.lon = geo.lon }
    }

    items = items.slice(0, limit)
    g.__searchCache.set(cacheKey, items)
    return NextResponse.json({ ok:true, items })
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status: 500 })
  }
}
