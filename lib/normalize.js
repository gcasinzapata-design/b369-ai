// lib/normalize.js
export function normalizeItem(it){
  const out = {
    id: it.id || cryptoRandom(),
    titulo: it.titulo || it.title || '',
    precio: Number(it.precio)||0,
    moneda: it.moneda || (String(it.precio).includes('S/')?'PEN':'USD'),
    m2: Number(it.m2)||0,
    habitaciones: it.habitaciones ? Number(it.habitaciones) : (guessHab(it.titulo)||0),
    banos: it.banos ? Number(it.banos) : 0,
    estacionamientos: it.estacionamientos ? Number(it.estacionamientos) : 0,
    direccion: it.direccion || it.address || '',
    url: it.url || '',
    fuente: it.fuente || 'web',
    lat: it.lat? Number(it.lat): null,
    lon: it.lon? Number(it.lon): null
  }
  return out
}
function cryptoRandom(){ return Math.random().toString(36).slice(2) }
function guessHab(t){
  if(!t) return 0
  const m = (t.match(/(\d)\s*(hab|habitación|habitaciones|dorm)/i)||[])[1]
  return m? Number(m):0
}
