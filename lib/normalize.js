// lib/normalize.js
const DIST_ALIASES = {
  'sani': 'san isidro',
  'mira': 'miraflores',
  'barr': 'barranco',
  'surco': 'santiago de surco',
  'lince': 'lince',
  'sjl': 'san juan de lurigancho',
  'sjm': 'san juan de miraflores',
  'mag': 'magdalena del mar',
  'pueblo': 'pueblo libre',
}

const TIPO_ALIASES = {
  'depa': 'departamento',
  'departamento': 'departamento',
  'casa': 'casa',
  'flat': 'departamento',
  'duplex': 'departamento'
}

export function normalizeNumberLike(str) {
  if (typeof str !== 'string') return Number(str) || 0
  const s = str.trim().toLowerCase().replace(/\s/g,'')
  const mK = s.match(/^(\d+(?:\.\d+)?)[k]$/)
  const mM = s.match(/^(\d+(?:\.\d+)?)[m]$/)
  if (mK) return Math.round(parseFloat(mK[1])*1000)
  if (mM) return Math.round(parseFloat(mM[1])*1000000)
  const n = s.replace(/[^0-9.]/g,'')
  return n ? Math.round(parseFloat(n)) : 0
}

export function normalizeDistrict(q='') {
  const s = q.toLowerCase()
  for (const k of Object.keys(DIST_ALIASES)) {
    if (s.includes(k)) return DIST_ALIASES[k]
  }
  return null
}

export function normalizeTipo(q='') {
  const s = q.toLowerCase()
  for (const k of Object.keys(TIPO_ALIASES)) {
    if (s.includes(k)) return TIPO_ALIASES[k]
  }
  return null
}

// Trata de extraer filtros básicos del texto libre
export function extractFiltersFromText(q='') {
  const txt = q.toLowerCase()

  const district = normalizeDistrict(txt)
  const tipo = normalizeTipo(txt)

  // precio máx: “250k”, “$250000”, “hasta 250”
  const maxPriceMatch =
    txt.match(/(?:hasta|<=|max|tope|precio(?:\s*m[aá]x)?)\s*([\d.,]+k?m?)/) ||
    txt.match(/(?:usd|s\/|s\.)?\s*([\d.,]+k?m?)\s*(?:usd|d[oó]lares|\$)/) ||
    txt.match(/([\d.,]+k?m?)\s*(?:usd|d[oó]lares|\$)/)

  const maxPrice = maxPriceMatch ? normalizeNumberLike(maxPriceMatch[1]) : 0

  // habitaciones mín: “2 hab”, “2d”, “>=2”
  const roomsMatch =
    txt.match(/(?:hab|habitaciones|dorm|d)\s*(\d+)/) ||
    txt.match(/(?:>=|al menos|mín(?:imo)?)\s*(\d+)\s*(?:hab|d|dorm)?/)
  const minRooms = roomsMatch ? parseInt(roomsMatch[1], 10) : 0

  // área mín: “desde 70m2”
  const areaMatch = txt.match(/(?:desde|>=|mín(?:imo)?)\s*([\d.,]+)\s*(?:m2|m²)/)
  const minArea = areaMatch ? Math.round(parseFloat(areaMatch[1].replace(',','.'))) : 0

  return { district, tipo, maxPrice, minRooms, minArea }
}
