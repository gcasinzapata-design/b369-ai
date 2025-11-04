export function normalizeItem(it){
  const precio = Number(it.precio ?? it.price ?? 0)
  const m2 = Number(it.m2 ?? it.area ?? 0)
  return {
    id: it.id || crypto.randomUUID(),
    titulo: it.titulo || it.title || '',
    precio,
    moneda: it.moneda || it.currency || 'USD',
    m2,
    habitaciones: Number(it.habitaciones ?? it.rooms ?? 0),
    banos: Number(it.banos ?? it.baths ?? 0),
    estacionamientos: Number(it.estacionamientos ?? it.parking ?? 0),
    direccion: it.direccion || it.address || '',
    lat: it.lat ? Number(it.lat) : undefined,
    lon: it.lon ? Number(it.lon) : undefined,
    fuente: it.fuente || it.source || 'web',
    url: it.url || ''
  }
}
