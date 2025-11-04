// app/api/search/route.js
import { NextResponse } from 'next/server'
import { z } from 'zod'

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
const ENABLE_SCRAPING = process.env.ENABLE_SCRAPING === '1'
const MAX_RESULTS = 60

// --- Caché en memoria (sobrevive por instancia) ---
const g = globalThis
if (!g.__geoCache) g.__geoCache = new Map()
const GEO_TTL_MS = 1000 * 60 * 60 * 24 // 24h

function geoCacheGet(key) {
  const it = g.__geoCache.get(key)
  if (!it) return null
  if (Date.now() - it.t > GEO_TTL_MS) { g.__geoCache.delete(key); return null }
  return it.v
}
function geoCacheSet(key, value) {
  g.__geoCache.set(key, { v: value, t: Date.now() })
}

// --- Validación de input ---
const SearchSchema = z.object({
  q: z.string().optional(),
  distrito: z.string().optional(),
  min_m2: z.number().int().nonnegative().optional(),
  min_hab: z.number().int().nonnegative().optional(),
  precio_max: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(MAX_RESULTS).optional()
}).passthrough()

async function geocodeIfMissing(item, { fallbackDistrito } = {}) {
  if (item.lat && item.lon) return item
  const addr =
    item.direccion ||
    item.titulo ||
    ''
  const key = `${addr}|${fallbackDistrito || ''}`.toLowerCase()
  const cached = geoCacheGet(key)
  if (cached) return { ...item, ...cached }

  const q = [addr, fallbackDistrito, 'Lima', 'Perú'].filter(Boolean).join(', ')
  const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(q)}&limit=1`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'b369-ai/1.0 (Netlify)' }
    })
    if (!r.ok) return item
    const arr = await r.json()
    if (Array.isArray(arr) && arr.length) {
      const { lat, lon } = arr[0]
      const enriched = { lat: Number(lat), lon: Number(lon) }
      geoCacheSet(key, enriched)
      return { ...item, ...enriched }
    }
  } catch (_) {}
  return item
}

// --- Fuente local fallback (mock) ---
async function loadMock() {
  try {
    // Nota: /public es estático. En server podemos leer vía fetch al asset.
    const r = await fetch(new URL('/mock.json', process.env.NEXT_PUBLIC_SITE_ORIGIN || 'http://localhost').toString())
    if (r.ok) return await r.json()
  } catch (_) {}
  // fallback final: import dinámico del archivo desde el FS en dev/local
  try {
    const fs = await import('node:fs/promises')
    const path = (await import('node:path')).default
    const p = path.join(process.cwd(), 'public', 'mock.json')
    const raw = await fs.readFile(p, 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// --- Scraping real (si se habilita) ---
// Aquí solo dejo la “orquestación”; tus proveedores reales van en lib/scrape/*.
// Si aún no están, esto seguirá funcionando con mock.
async function scrapeAllProviders(filters) {
  // IMPORTANTE: tus funciones reales deberían respetar estos filtros y normalizar campos.
  // Si ya creaste lib/scrape/providers.js con urbania/adondevivir/etc, impórtalo aquí:
  // const { searchAll } = await import('@/lib/scrape/providers')
  // return await searchAll(filters)

  // Placeholder temporal hasta conectar proveedores reales:
  return []
}

function normalize(items) {
  // Quitar nulos/duplicados por id/url
  const seen = new Set()
  const out = []
  for (const it of items) {
    const id = it.id || it.url || `${it.titulo}-${it.precio}-${it.m2}`
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      titulo: it.titulo || 'Propiedad',
      precio: Number(it.precio) || 0,
      moneda: it.moneda === 'USD' ? 'USD' : 'USD', // homogeneiza a USD si no especifican
      m2: Number(it.m2) || 0,
      habitaciones: it.habitaciones ?? null,
      banos: it.banos ?? null,
      estacionamientos: it.estacionamientos ?? null,
      direccion: it.direccion || null,
      fuente: it.fuente || 'web',
      url: it.url || null,
      lat: it.lat ? Number(it.lat) : null,
      lon: it.lon ? Number(it.lon) : null,
      distrito: (it.distrito || '').toString()
    })
  }
  return out
}

function applyFilters(items, { distrito, min_m2, min_hab, precio_max }) {
  return items.filter(it => {
    if (distrito && it.distrito && it.distrito.toLowerCase() !== distrito.toLowerCase()) return false
    if (typeof min_m2 === 'number' && it.m2 && it.m2 < min_m2) return false
    if (typeof min_hab === 'number' && it.habitaciones && it.habitaciones < min_hab) return false
    if (typeof precio_max === 'number' && it.precio && it.precio > precio_max) return false
    return true
  })
}

export async function POST(req) {
  try {
    const body = await req.json()
    const input = SearchSchema.safeParse({
      ...body,
      // coerce strings tipo “250K” → 250000, “51” → number
      precio_max: body?.precio_max != null ? parseBudget(body.precio_max) : undefined,
      min_m2: body?.min_m2 != null ? Number(body.min_m2) : undefined,
      min_hab: body?.min_hab != null ? Number(body.min_hab) : undefined
    })
    if (!input.success) {
      return NextResponse.json({ ok: false, error: 'Parámetros inválidos', issues: input.error.issues }, { status: 400 })
    }
    const { distrito, min_m2, min_hab, precio_max } = input.data
    const limit = input.data.limit || 40

    let items = []
    if (ENABLE_SCRAPING) {
      items = await scrapeAllProviders(input.data)
    } else {
      const mock = await loadMock()
      items = mock
    }

    // normaliza, filtra
    items = normalize(items)
    items = applyFilters(items, { distrito, min_m2, min_hab, precio_max })

    // geocodifica faltantes (con límite para no saturar Nominatim)
    const needGeo = items.slice(0, Math.min(items.length, 50))
    const enriched = await Promise.all(needGeo.map(it => geocodeIfMissing(it, { fallbackDistrito: distrito })))
    const withGeo = enriched.concat(items.slice(needGeo.length))

    // corta a límite
    const finalItems = withGeo.slice(0, limit)

    return NextResponse.json({ ok: true, items: finalItems })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error en búsqueda' }, { status: 500 })
  }
}

// convierte “250K”→250000, “1.2M”→1200000, “250000”→250000
function parseBudget(v) {
  if (typeof v === 'number') return v
  const s = String(v).trim().toUpperCase()
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*([KM]?)$/)
  if (!m) return Number(s) || undefined
  const num = parseFloat(m[1])
  const suf = m[2]
  if (suf === 'K') return Math.round(num * 1_000)
  if (suf === 'M') return Math.round(num * 1_000_000)
  return Math.round(num)
}
