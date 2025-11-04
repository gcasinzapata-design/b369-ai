export async function POST(req) {
  try {
    const { q } = await req.json()
    const base = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org'
    const url = `${base}/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`
    const r = await fetch(url, { headers: { 'User-Agent': 'b369-ai/1.0 (netlify)' } })
    if (!r.ok) return new Response(JSON.stringify({ ok: false, error: 'geocode failed' }), { status: 502 })
    const arr = await r.json()
    if (!arr?.length) return new Response(JSON.stringify({ ok: false, error: 'no results' }), { status: 404 })
    const { lat, lon, display_name } = arr[0]
    return new Response(JSON.stringify({ ok: true, lat: Number(lat), lon: Number(lon), label: display_name }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'error' }), { status: 500 })
  }
}
