// app/api/search/route.js
import { NextResponse } from 'next/server'
import { scrapeAll } from '../../../lib/scrape/providers.js'
import { z } from 'zod'

const QuerySchema = z.object({
  q: z.string().default(''),
  minArea: z.number().optional(),
  minRooms: z.number().optional(),
  district: z.string().optional(),
  maxPrice: z.number().optional()
})

/**
 * Cache simple en memoria para evitar re-geocodificar lo mismo.
 * Dura 1 hora por key.
 */
const geoCache = new Map()
function setCache(key, value) {
  geoCache.set(key, { value, ts: Date.now() })
}
function getCache(key) {
  const entry = geoCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > 1000 * 60 * 60) { // 1h
    geoCache.delete(key)
    return null
  }
  return entry.value
}

async function geocode(address) {
  const base = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org'
  const key = address.toLowerCase().trim()
  const cached = getCache(key)
  if (cached) return cached

  const url = `${base}/search?format=json&q=${encodeURIComponent(address)}&limit=1`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'B369AI/1.0 (contact: admin@b369.ai)' }
    })
    if (!r.ok) return null
    const j = await r.json()
    if (Array.isArray(j) && j[0]) {
      const { lat, lon, display_name } = j[0]
      const result = { lat: Number(lat), lon: Number(lon), name: display_name }
      setCache(key, result)
      return result
    }
  } catch (e) {
    console.warn('Geocode fail:', e.message)
  }
  return null
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { q, minArea, minRooms, district, maxPrice } = QuerySchema.parse(body)
    const ENABLE_SCRAPING = process.env.ENABLE_SCRAPING === 'true'

    // Scraping o mock
    const items = await scrapeAll({ q, minArea, minRooms, district, maxPrice, enable: ENABLE_SCRAPING })

    // Geocodifica hasta 10 resultados que no tengan coords
    const limit = 10
    const tasks = []
    for (const it of items.slice(0, limit)) {
      if (!it.lat && !it.lon && it.direccion) {
        tasks.push(
          geocode(it.direccion).then((g) => {
            if (g) {
              it.lat = g.lat
              it.lon = g.lon
            }
          })
        )
      }
    }
    await Promise.allSettled(tasks)

    return NextResponse.json({ ok: true, items })
  } catch (err) {
    console.error('Search API error', err)
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
