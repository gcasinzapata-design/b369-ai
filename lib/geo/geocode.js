// lib/geo/geocode.js
const CACHE = globalThis.__GEOCACHE__ || (globalThis.__GEOCACHE__ = new Map());

export async function geocodeAddress(address, districtHint = '', country = 'Perú') {
  const key = `${address}|${districtHint}|${country}`.toLowerCase();
  if (CACHE.has(key)) return CACHE.get(key);

  const base = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
  // Fortalece la consulta con distrito + país si no viene explícito
  const q = [address, districtHint, 'Lima', country].filter(Boolean).join(', ');
  const url = `${base}?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'b369-ai/1.0 (Netlify; contacto: soporte@b369.ai)',
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    const err = { ok:false, error:`geocode_http_${res.status}` };
    CACHE.set(key, err); return err;
  }
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr.length) {
    const nope = { ok:false, error:'no_geocode' };
    CACHE.set(key, nope); return nope;
  }
  const { lat, lon, display_name } = arr[0];
  const out = { ok:true, lat:+lat, lon:+lon, display_name };
  CACHE.set(key, out);
  return out;
}
