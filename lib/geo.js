// lib/geo.js
export async function geocode(q){
  try{
    const base = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
    const url = `${base}?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=0`
    const r = await fetch(url, { headers:{ 'User-Agent':'b369-ai/1.0 (netlify)' } })
    const j = await r.json()
    if(Array.isArray(j) && j[0]) return { lat:Number(j[0].lat), lon:Number(j[0].lon) }
  }catch{}
  return null
}

export function haversine(a,b){
  const R=6371, toRad=(d)=>d*Math.PI/180
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon)
  const s1=Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.sqrt(s1))
}
export function median(arr){
  const s=arr.slice().sort((x,y)=>x-y); const n=s.length
  return n? (n%2? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2) : 0
}
export function percentile(arr,p){
  if(!arr.length) return 0
  const s=arr.slice().sort((a,b)=>a-b); const idx=(s.length-1)*p
  const lo=Math.floor(idx), hi=Math.ceil(idx)
  if(lo===hi) return s[lo]
  return s[lo] + (s[hi]-s[lo])*(idx-lo)
}
