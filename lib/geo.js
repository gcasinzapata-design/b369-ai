// lib/geo.js
const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
const PHOTON = 'https://photon.komoot.io/api/?q='

const g = globalThis
if (!g.__geoCache) g.__geoCache = new Map()

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

async function tryNominatim(q) {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'b369-ai/1.0 (Netlify; contact: contact@example.com)',
      'Accept': 'application/json'
    }
  }).catch(()=>null)
  if (!res || !res.ok) return null
  const arr = await res.json().catch(()=>null)
  const hit = Array.isArray(arr) && arr[0]
  return hit ? { lat: +hit.lat, lon: +hit.lon } : null
}

async function tryPhoton(q) {
  const url = `${PHOTON}${encodeURIComponent(q)}&limit=1`
  const res = await fetch(url, { headers:{'Accept':'application/json'} }).catch(()=>null)
  if (!res || !res.ok) return null
  const json = await res.json().catch(()=>null)
  const feat = json?.features?.[0]
  const coords = feat?.geometry?.coordinates
  return (coords && coords.length>=2) ? { lon: +coords[0], lat: +coords[1] } : null
}

export async function geocodeAddress(addrRaw, districtRaw='') {
  const addr = (addrRaw||'').trim()
  const district = (districtRaw||'').trim()
  const key = `${addr}|${district}`.toLowerCase()
  if (g.__geoCache.has(key)) return g.__geoCache.get(key)

  // intentos en cascada
  const candidates = [
    [addr, district, 'Lima', 'Perú'].filter(Boolean).join(', '),
    [addr, 'Santiago de Surco', 'Lima', 'Perú'].filter(Boolean).join(', '), // caso frecuente
    [addr, 'Miraflores', 'Lima', 'Perú'].filter(Boolean).join(', '),
    [addr, 'Lima', 'Perú'].filter(Boolean).join(', ')
  ]

  let out = null
  for (const q of candidates) {
    out = await tryNominatim(q)
    if (out) break
    await sleep(350)
  }
  if (!out) {
    for (const q of candidates) {
      out = await tryPhoton(q)
      if (out) break
      await sleep(350)
    }
  }

  if (out) g.__geoCache.set(key, out)
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
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
  return 2 * R * Math.asin(Math.sqrt(x))
}
