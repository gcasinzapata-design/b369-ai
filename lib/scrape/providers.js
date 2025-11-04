// lib/scrape/providers.js
import * as cheerio from 'cheerio'
import { normalizeNumberLike } from '../normalize.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

// Limpia strings
function clean(s){ return (s||'').replace(/\s+/g,' ').trim() }

// Intenta parsear “xx m2” o “xx m²”
function pickM2(text) {
  const t = (text||'').toLowerCase()
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*m(?:2|²)/)
  if (!m) return 0
  return Math.round(parseFloat(m[1].replace(',','.')))
}

// Habitaciones aproximadas “2 hab”, “2 dorm”
function pickRooms(text) {
  const t = (text||'').toLowerCase()
  const m = t.match(/(\d+)\s*(hab|dorm)/)
  return m ? parseInt(m[1],10) : undefined
}

/** URBANIA */
export async function searchUrbania({ q, district, minRooms, minArea, maxPrice, limit=20 }) {
  const query = [q, district].filter(Boolean).join(' ')
  const url = `https://urbania.pe/buscar?order=most_relevant&query=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } }).catch(()=>null)
  if (!res || !res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out = []

  $('.posting-card').each((_, el) => {
    if (out.length >= limit) return
    const $el = $(el)

    const $titleA = $el.find('.posting-card__title a').first()
    const href = $titleA.attr('href') || $el.find('a').first().attr('href')
    const urlAbs = href?.startsWith('http') ? href : href ? `https://urbania.pe${href}` : undefined

    const titulo = clean($titleA.text() || $el.find('.posting-card__title').text())
    const priceTxt = clean($el.find('.first-price,.posting-card__price').first().text())
    const precio = normalizeNumberLike(priceTxt)
    const moneda = priceTxt.includes('S/') ? 'PEN' : 'USD'

    const info = clean($el.find('.posting-card__features').text() || $el.text())
    const m2 = pickM2(info)
    const habitaciones = pickRooms(info)

    if (minArea && m2 && m2 < minArea) return
    if (minRooms && habitaciones && habitaciones < minRooms) return
    if (maxPrice && precio && precio > maxPrice) return

    const address = clean($el.find('.posting-card__location').text())
    out.push({
      id: urlAbs || titulo,
      titulo,
      precio,
      moneda,
      m2,
      habitaciones,
      direccion: address || district,
      fuente: 'urbania',
      url: urlAbs
    })
  })
  return out
}

/** ADONDEVIVIR */
export async function searchAdondevivir({ q, district, minRooms, minArea, maxPrice, limit=20 }) {
  const query = [q, district].filter(Boolean).join(' ')
  const url = `https://www.adondevivir.com/buscar?QueryString=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } }).catch(()=>null)
  if (!res || !res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out = []

  // Selector flexible: cada tarjeta tiene variaciones
  $('[data-posting-card], .posting-card, .ui-card').each((_, el) => {
    if (out.length >= limit) return
    const $el = $(el)
    const $a = $el.find('[data-posting-title], a[itemprop="url"], a').first()
    const href = $a.attr('href')
    const urlAbs = href?.startsWith('http') ? href : href ? `https://www.adondevivir.com${href}` : undefined

    const titulo = clean($el.find('[data-posting-title], [itemprop="name"], h2, h3').first().text())
    const priceTxt = clean($el.find('[data-posting-price], .price-items, .first-price, .price').first().text())
    const precio = normalizeNumberLike(priceTxt)
    const moneda = priceTxt.includes('S/') ? 'PEN' : 'USD'

    const featuresTxt = clean($el.text())
    const m2 = pickM2(featuresTxt)
    const habitaciones = pickRooms(featuresTxt)

    if (minArea && m2 && m2 < minArea) return
    if (minRooms && habitaciones && habitaciones < minRooms) return
    if (maxPrice && precio && precio > maxPrice) return

    const address = clean($el.find('[data-posting-location], .location, .posting-address').first().text())

    out.push({
      id: urlAbs || titulo,
      titulo,
      precio,
      moneda,
      m2,
      habitaciones,
      direccion: address || district,
      fuente: 'adondevivir',
      url: urlAbs
    })
  })
  return out
}

// A completar luego (por ahora devuelven vacío para no romper):
export async function searchBabilonia(){ return [] }
export async function searchOLX(){ return [] }
export async function searchProperati(){ return [] }
