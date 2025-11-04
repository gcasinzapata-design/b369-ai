// lib/geo.js
const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'

const g = globalThis
if (!g.__geoCache) g.__geoCache = new Map()

export async function geocodeAddress(addr, district='') {
  const key = `${addr}|${district}`.toLowerCase()
  if (g.__geoCache.has(key)) return g.__geoCache.get(key)

  const q = [addr, district, 'Lima', 'Perú'].filter(Boolean).join(', ')
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'b369-ai/1.0 (Netlify Build; contact: example@example.com)'
    }
  })
  if (!res.ok) return null
  const arr = await res.json()
  const hit = Array.isArray(arr) && arr[0]
  const out = hit ? { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) } : null
  g.__geoCache.set(key, out)
  return out
}

export function distMeters(a, b) {
  if (!a || !b) return Infinity
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
  const d = 2 * R * Math.asin(Math.sqrt(x))
  return d
}
