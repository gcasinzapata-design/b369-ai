// app/api/search/route.js
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { extractFiltersFromText, normalizeNumberLike } from '../../../lib/normalize'
import { geocodeAddress } from '../../../lib/geo'
import { searchUrbania, searchAdondevivir, searchBabilonia, searchOLX, searchProperati } from '../../../lib/scrape/providers'

const ENABLE_SCRAPING = process.env.ENABLE_SCRAPING === '1'

const BodySchema = z.object({
  q: z.string().optional(),
  district: z.string().optional(),
  minArea: z.number().int().nonnegative().optional(),
  minRooms: z.number().int().nonnegative().optional(),
  maxPrice: z.number().int().nonnegative().optional(),
  tipo: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(40)
})

const g = globalThis
if (!g.__searchCache) g.__searchCache = new Map()

export async function POST(req) {
  try {
    const body = await req.json()
    const parsed = BodySchema.safeParse({
      ...body,
      // normaliza numéricos si vinieron como string
      minArea: typeof body?.minArea === 'string' ? normalizeNumberLike(body.minArea) : body?.minArea,
      minRooms: typeof body?.minRooms === 'string' ? normalizeNumberLike(body.minRooms) : body?.minRooms,
      maxPrice: typeof body?.maxPrice === 'string' ? normalizeNumberLike(body.maxPrice) : body?.maxPrice,
    })
    if (!parsed.success) {
      return NextResponse.json({ ok:false, error:'invalid_body', issues: parsed.error.issues }, { status: 400 })
    }
    let { q='', district, minArea=0, minRooms=0, maxPrice=0, tipo, limit } = parsed.data

    // si hay texto libre, extrae filtros
    if (q) {
      const ex = extractFiltersFromText(q)
      district ||= ex.district || undefined
      tipo ||= ex.tipo || undefined
      maxPrice ||= ex.maxPrice || 0
      minRooms ||= ex.minRooms || 0
      minArea ||= ex.minArea || 0
    }

    // Cache key
    const cacheKey = JSON.stringify({ q, district, minArea, minRooms, maxPrice, tipo, limit })
    if (g.__searchCache.has(cacheKey)) {
      return NextResponse.json({ ok:true, items: g.__searchCache.get(cacheKey) })
    }

    let items = []

    if (ENABLE_SCRAPING) {
      // Prioridad de proveedores (como pediste)
      const queries = [
        searchUrbania({ q, district, minRooms, minArea, maxPrice, limit }),
        searchAdondevivir({ q, district, minRooms, minArea, maxPrice, limit }),
        searchBabilonia({ q, district, minRooms, minArea, maxPrice, limit }),
        searchOLX({ q, district, minRooms, minArea, maxPrice, limit }),
        searchProperati({ q, district, minRooms, minArea, maxPrice, limit }),
      ]
      const results = await Promise.allSettled(queries)
      for (const r of results) if (r.status === 'fulfilled') items.push(...r.value)
    } else {
      // Fallback offline/mocks si scraping off
      // Nota: puedes enriquecerlo leyendo public/mock.json
      try {
        const res = await fetch(new URL('/mock.json', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost').toString()).catch(()=>null)
        if (res && res.ok) {
          const mock = await res.json()
          items = Array.isArray(mock) ? mock : []
        }
      } catch {}
    }

    // Filtrado adicional y geocodificar cuando falten coords
    items = items.filter((it) => {
      if (minArea && it.m2 && it.m2 < minArea) return false
      if (minRooms && typeof it.habitaciones === 'number' && it.habitaciones < minRooms) return false
      if (maxPrice && it.precio && it.precio > maxPrice) return false
      if (tipo && it.titulo && !it.titulo.toLowerCase().includes(tipo)) return false
      if (district && it.direccion && !it.direccion.toLowerCase().includes(district.toLowerCase())) {
        // si la dirección no menciona el distrito, lo toleramos porque muchos sitios no lo ponen
      }
      return true
    })

    // geocode aproximado para los que no traen lat/lon
    for (const it of items.slice(0, limit)) {
      if ((it.lat && it.lon) || !it.direccion) continue
      const geo = await geocodeAddress(it.direccion, district || '')
      if (geo) { it.lat = geo.lat; it.lon = geo.lon }
    }

    // recorta a límite
    items = items.slice(0, limit)

    // guarda cache simple (memoria cold-start friendly)
    g.__searchCache.set(cacheKey, items)

    return NextResponse.json({ ok:true, items })
  } catch (e) {
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status: 500 })
  }
}
