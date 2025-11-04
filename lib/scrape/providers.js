// lib/scrape/providers.js
import * as cheerio from 'cheerio'
import { normalizeNumberLike } from '../normalize'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

/**
 * Cada proveedor retorna: { id, titulo, precio, moneda, m2, habitaciones?, banos?, estacionamientos?, direccion?, fuente, url }
 * Nota: Estos scrapers son aproximados; sitios pueden cambiar HTML o bloquear.
 */

export async function searchUrbania({ q, district, minRooms, minArea, maxPrice, limit=20 }) {
  // Búsqueda aproximada por query textual. Urbania usa distintos filtros; aquí simplificamos.
  const url = `https://urbania.pe/buscar?order=most_relevant&query=${encodeURIComponent([q, district].filter(Boolean).join(' '))}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out = []
  $('.posting-card').each((_, el) => {
    if (out.length >= limit) return
    const $el = $(el)
    const titulo = $el.find('.posting-card__title').text().trim()
    const href = $el.find('a.posting-card__title').attr('href') || $el.find('a').attr('href')
    const urlAbs = href?.startsWith('http') ? href : href ? `https://urbania.pe${href}` : undefined

    const priceTxt = $el.find('.first-price').text().trim() || $el.find('.posting-card__price').text().trim()
    const precio = normalizeNumberLike(priceTxt)
    const moneda = priceTxt.includes('S/') ? 'PEN' : 'USD'

    // m2 / hab (aprox)
    const info = $el.find('.posting-card__features').text().toLowerCase()
    const m2m = info.match(/(\d+)\s*m2|\s*m²/)
    const m2 = m2m ? parseInt(m2m[1] || m2m[2] || '0',10) : 0
    const habm = info.match(/(\d+)\s*(hab|dorm)/)
    const habitaciones = habm ? parseInt(habm[1],10) : undefined

    // filtros
    if (minArea && m2 && m2 < minArea) return
    if (minRooms && habitaciones && habitaciones < minRooms) return
    if (maxPrice && precio && precio > maxPrice) return

    out.push({
      id: urlAbs || titulo,
      titulo,
      precio,
      moneda,
      m2,
      habitaciones,
      fuente: 'urbania',
      url: urlAbs
    })
  })
  return out
}

export async function searchAdondevivir({ q, district, minRooms, minArea, maxPrice, limit=20 }) {
  const url = `https://www.adondevivir.com/buscar?QueryString=${encodeURIComponent([q, district].filter(Boolean).join(' '))}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out = []
  $('[data-posting-card]').each((_, el) => {
    if (out.length >= limit) return
    const $el = $(el)
    const titulo = $el.find('[data-posting-title]').text().trim()
    const href = $el.find('a').attr('href')
    const urlAbs = href?.startsWith('http') ? href : href ? `https://www.adondevivir.com${href}` : undefined

    const priceTxt = $el.find('[data-posting-price]').text().trim()
    const precio = normalizeNumberLike(priceTxt)
    const moneda = priceTxt.includes('S/') ? 'PEN' : 'USD'

    const info = $el.text().toLowerCase()
    const m2m = info.match(/(\d+)\s*m2|\s*m²/)
    const m2 = m2m ? parseInt(m2m[1] || m2m[2] || '0',10) : 0
    const habm = info.match(/(\d+)\s*(hab|dorm)/)
    const habitaciones = habm ? parseInt(habm[1],10) : undefined

    if (minArea && m2 && m2 < minArea) return
    if (minRooms && habitaciones && habitaciones < minRooms) return
    if (maxPrice && precio && precio > maxPrice) return

    out.push({ id:urlAbs||titulo, titulo, precio, moneda, m2, habitaciones, fuente:'adondevivir', url:urlAbs })
  })
  return out
}

// Stubs simples (puedes completar igual que arriba cuando tengas selectores estables):
export async function searchBabilonia() { return [] }
export async function searchOLX() { return [] }
export async function searchProperati() { return [] }
