// lib/geo.js
const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
const cache = new Map()
function set(k,v){ cache.set(k, {v,ts:Date.now()}) }
function get(k){
  const e = cache.get(k); if(!e) return null
  if (Date.now()-e.ts>3600_000){ cache.delete(k); return null }
  return e.v
}
export async function geocode(address){
  if(!address) return null
  const key = address.toLowerCase().trim()
  const hit = get(key); if(hit) return hit
  const url = `${NOMINATIM}?format=json&q=${encodeURIComponent(address)}&limit=1`
  const r = await fetch(url, { headers:{ 'User-Agent':'B369AI/1.0 (contact: admin@b369.ai)' } })
  if(!r.ok) return null
  const j = await r.json()
  if(Array.isArray(j) && j[0]){
    const { lat, lon, display_name } = j[0]
    const out = { lat:Number(lat), lon:Number(lon), name:display_name }
    set(key,out); return out
  }
  return null
}
export function haversine(a,b){
  const R=6371, d2r=(x)=>x*Math.PI/180
  const dLat=d2r(b.lat-a.lat), dLon=d2r(b.lon-a.lon)
  const s1=Math.sin(dLat/2)**2
  const s2=Math.cos(d2r(a.lat))*Math.cos(d2r(b.lat))*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.sqrt(s1+s2))
}
export function percentile(arr, p){
  if(!arr.length) return 0
  const s=[...arr].sort((a,b)=>a-b); const idx=(s.length-1)*p
  const lo=Math.floor(idx), hi=Math.ceil(idx)
  return lo===hi ? s[lo] : s[lo]+(s[hi]-s[lo])*(idx-lo)
}
export function median(arr){
  if(!arr.length) return 0
  const s=[...arr].sort((a,b)=>a-b); const i=Math.floor(s.length/2)
  return s.length%2 ? s[i] : (s[i-1]+s[i])/2
}
