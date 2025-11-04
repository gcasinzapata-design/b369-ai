// lib/scrape/providers.js
import * as cheerio from 'cheerio'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) B369AI/1.0'
const TIMEOUT = 12000

function controller(timeoutMs = TIMEOUT) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  return { signal: ctrl.signal, done: () => clearTimeout(t) }
}

function asNum(x) {
  const n = Number(String(x).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function normalizeItem(p) {
  return {
    id: p.id || p.url || Math.random().toString(36).slice(2),
    titulo: p.titulo?.trim() || 'Propiedad',
    precio: asNum(p.precio),
    moneda: p.moneda || 'USD',
    m2: asNum(p.m2),
    habitaciones: asNum(p.habitaciones),
    banos: asNum(p.banos),
    estacionamientos: asNum(p.estacionamientos),
    direccion: p.direccion || '',
    fuente: p.fuente || 'web',
    url: p.url || ''
  }
}

/** Urbania: búsqueda simple por q en Google como fallback (site:), y parseo cards si posible */
async function scrapeUrbania({ q }) {
  // Buscador interno de Urbania puede protegerse; usamos ruta de listados con query textual
  const url = `https://urbania.pe/buscar?palabras=${encodeURIComponent(q)}`
  const { signal, done } = controller()
  try {
    const r = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error('Urbania no OK')
    const html = await r.text()
    const $ = cheerio.load(html)
    const items = []
    $('[data-qa="posting CARD"]').each((_, el) => {
      const titulo = $(el).find('h2').text()
      const precioT = $(el).find('[data-qa="POSTING_CARD_PRICE"]').text()
      const m2T = $(el).find('[data-qa="POSTING_CARD_FEATURES"]').text()
      const url = $(el).find('a').attr('href')
      items.push(normalizeItem({
        titulo,
        precio: precioT,
        m2: m2T,
        url: url?.startsWith('http') ? url : `https://urbania.pe${url}`,
        fuente: 'urbania'
      }))
    })
    return items
  } catch {
    return []
  } finally { done() }
}

async function scrapeAdondevivir({ q }) {
  const url = `https://www.adondevivir.com/buscar?palabras=${encodeURIComponent(q)}`
  const { signal, done } = controller()
  try {
    const r = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error('ADV no OK')
    const html = await r.text()
    const $ = cheerio.load(html)
    const items = []
    $('li[data-posting-id]').each((_, el) => {
      const titulo = $(el).find('h2').text()
      const precioT = $(el).find('.price-items').text()
      const m2T = $(el).find('.main-features').text()
      const link = $(el).find('a').attr('href')
      items.push(normalizeItem({
        titulo,
        precio: precioT,
        m2: m2T,
        url: link?.startsWith('http') ? link : `https://www.adondevivir.com${link}`,
        fuente: 'adondevivir'
      }))
    })
    return items
  } catch {
    return []
  } finally { done() }
}

async function scrapeProperati({ q }) {
  const url = `https://www.properati.com.pe/s/${encodeURIComponent(q)}`
  const { signal, done } = controller()
  try {
    const r = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error('Properati no OK')
    const html = await r.text()
    const $ = cheerio.load(html)
    const items = []
    $('[data-qa="posting-card"]').each((_, el) => {
      const titulo = $(el).find('h2').text()
      const precioT = $(el).find('[data-qa="POSTING_CARD_PRICE"]').text()
      const m2T = $(el).find('[data-qa="POSTING_CARD_FEATURES"]').text()
      const link = $(el).find('a').attr('href')
      items.push(normalizeItem({
        titulo,
        precio: precioT,
        m2: m2T,
        url: link?.startsWith('http') ? link : `https://www.properati.com.pe${link}`,
        fuente: 'properati'
      }))
    })
    return items
  } catch {
    return []
  } finally { done() }
}

async function scrapeOLX({ q }) {
  const url = `https://www.olx.com.pe/inmuebles_c-16/q-${encodeURIComponent(q)}`
  const { signal, done } = controller()
  try {
    const r = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error('OLX no OK')
    const html = await r.text()
    const $ = cheerio.load(html)
    const items = []
    $('li').each((_, el) => {
      const titulo = $(el).find('h6').text()
      const precioT = $(el).find('span').first().text()
      const link = $(el).find('a').attr('href')
      if (titulo && link) {
        items.push(normalizeItem({
          titulo,
          precio: precioT,
          m2: '',
          url: link?.startsWith('http') ? link : `https://www.olx.com.pe${link}`,
          fuente: 'olx'
        }))
      }
    })
    return items
  } catch {
    return []
  } finally { done() }
}

async function scrapeBabilonia({ q }) {
  const url = `https://babilonia.pe/buscar?keyword=${encodeURIComponent(q)}`
  const { signal, done } = controller()
  try {
    const r = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error('Babilonia no OK')
    const html = await r.text()
    const $ = cheerio.load(html)
    const items = []
    $('.property-card, .card').each((_, el) => {
      const titulo = $(el).find('h3, h2').first().text()
      const precioT = $(el).find('.price, .property-price').first().text()
      const m2T = $(el).find('.features, .property-features').first().text()
      const link = $(el).find('a').attr('href')
      if (titulo && link) {
        items.push(normalizeItem({
          titulo,
          precio: precioT,
          m2: m2T,
          url: link?.startsWith('http') ? link : `https://babilonia.pe${link}`,
          fuente: 'babilonia'
        }))
      }
    })
    return items
  } catch {
    return []
  } finally { done() }
}

export async function scrapeAll({ q, minArea, minRooms, district, maxPrice, enable }) {
  if (!enable) {
    // Fallback consistente para UX y para pruebas
    return [
      { titulo: 'Departamento vista al mar', precio: 210000, moneda: 'USD', m2: 78, habitaciones: 2, direccion: 'Malecón 28 de Julio', url: '#', fuente: 'sample' },
      { titulo: 'Flat remodelado cerca al parque', precio: 185000, moneda: 'USD', m2: 70, habitaciones: 2, direccion: 'Av. La Paz', url: '#', fuente: 'sample' },
      { titulo: 'Casa amplia con jardín', precio: 360000, moneda: 'USD', m2: 160, habitaciones: 4, direccion: 'Calle Tarata', url: '#', fuente: 'sample' }
    ].map(normalizeItem)
  }

  const tasks = [
    scrapeUrbania({ q }),
    scrapeAdondevivir({ q }),
    scrapeProperati({ q }),
    scrapeOLX({ q }),
    scrapeBabilonia({ q })
  ]
  const results = await Promise.allSettled(tasks)
  let items = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  // filtros server-side básicos
  if (minArea) items = items.filter(i => (i.m2 || 0) >= minArea)
  if (minRooms) items = items.filter(i => (i.habitaciones || 0) >= minRooms)
  if (maxPrice) items = items.filter(i => (i.precio || 0) <= maxPrice)
  // dedupe por URL
  const byUrl = new Map()
  for (const it of items) if (it.url && !byUrl.has(it.url)) byUrl.set(it.url, it)
  return Array.from(byUrl.values()).map(normalizeItem).slice(0, 60)
}
