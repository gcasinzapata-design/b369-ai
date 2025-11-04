// lib/scrape/providers.js
import * as cheerio from 'cheerio'
import { normalizeNumberLike } from '../normalize.js'
import { fetchHtmlSmart } from '../fetchHtml.js'

function clean(s){ return (s||'').replace(/\s+/g,' ').trim() }
function pickM2(text) {
  const t = (text||'').toLowerCase()
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*m(?:2|²)/)
  return m ? Math.round(parseFloat(m[1].replace(',','.'))) : 0
}
function pickRooms(text) {
  const t = (text||'').toLowerCase()
  const m = t.match(/(\d+)\s*(hab|dorm|dormitorio)/)
  return m ? parseInt(m[1],10) : undefined
}
function fromJsonLD($){
  const out=[]
  $('script[type="application/ld+json"]').each((_,el)=>{
    try{
      const json = JSON.parse($(el).contents().text()||'{}')
      const list = Array.isArray(json) ? json : json?.itemListElement || json?.@graph || []
      const arr = Array.isArray(list) ? list : [list]
      for (const it of arr){
        const name = it?.name || it?.headline || it?.title
        const offer = it?.offers || {}
        const price = offer?.price || offer?.lowPrice || offer?.highPrice
        const currency = offer?.priceCurrency || (offer?.price && 'USD')
        if (name && price){
          out.push({
            id: it?.url || name,
            titulo: clean(name),
            precio: Number(price) || normalizeNumberLike(String(price)),
            moneda: currency || 'USD',
            m2: pickM2(JSON.stringify(it)),
            habitaciones: pickRooms(JSON.stringify(it)),
            direccion: it?.address?.streetAddress || it?.address?.addressLocality || '',
            fuente: 'jsonld',
            url: it?.url
          })
        }
      }
    }catch{}
  })
  return out
}

/** URBANIA */
export async function searchUrbania({ q, district, minRooms, minArea, maxPrice, limit=30 }) {
  const query = [q, district].filter(Boolean).join(' ')
  const url = `https://urbania.pe/buscar?order=most_relevant&query=${encodeURIComponent(query)}`
  const html = await fetchHtmlSmart(url)
  if (!html) return []
  const $ = cheerio.load(html)
  const out = []

  // 1) JSON-LD primero (suele traer datos)
  const fromLD = fromJsonLD($)
  if (fromLD.length) out.push(...fromLD)

  // 2) Tarjetas visibles
  $('.posting-card, [data-posting-id]').each((_,el)=>{
    if (out.length >= limit) return
    const $el = $(el)
    const $a = $el.find('.posting-card__title a, a[data-to-posting], a').first()
    const href = $a.attr('href')
    const urlAbs = href?.startsWith('http') ? href : href ? `https://urbania.pe${href}` : undefined

    const titulo = clean($a.text() || $el.find('.posting-card__title').text())
    const priceTxt = clean($el.find('.first-price,.posting-card__price,.price-items,.price').first().text())
    const precio = normalizeNumberLike(priceTxt)
    const moneda = priceTxt.includes('S/') ? 'PEN' : 'USD'
    const info = clean($el.find('.posting-card__features,.main-features').text() || $el.text())
    const m2 = pickM2(info)
    const habitaciones = pickRooms(info)
    const address = clean($el.find('.posting-card__location,.location').first().text())

    out.push({
      id: urlAbs || titulo,
      titulo,
      precio,
      moneda,
      m2,
      habitaciones,
      direccion: address || district || '',
      fuente: 'urbania',
      url: urlAbs
    })
  })

  return postFilter(out, {minRooms,minArea,maxPrice,limit})
}

/** ADONDEVIVIR */
export async function searchAdondevivir({ q, district, minRooms, minArea, maxPrice, limit=30 }) {
  const query = [q, district].filter(Boolean).join(' ')
  const url = `https://www.adondevivir.com/buscar?QueryString=${encodeURIComponent(query)}`
  const html = await fetchHtmlSmart(url)
  if (!html) return []
  const $ = cheerio.load(html)
  const out = []

  const fromLD = fromJsonLD($)
  if (fromLD.length) out.push(...fromLD)

  $('[data-posting-card], .posting-card, .ui-card, article').each((_,el)=>{
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

    const address = clean($el.find('[data-posting-location], .location, .posting-address').first().text())

    out.push({
      id: urlAbs || titulo,
      titulo,
      precio,
      moneda,
      m2,
      habitaciones,
      direccion: address || district || '',
      fuente: 'adondevivir',
      url: urlAbs
    })
  })

  return postFilter(out, {minRooms,minArea,maxPrice,limit})
}

export async function searchBabilonia(){ return [] }
export async function searchOLX(){ return [] }
export async function searchProperati(){ return [] }

// filtro común + limit
function postFilter(items, {minRooms,minArea,maxPrice,limit}){
  let arr = items.filter(it=>{
    if (minArea && it.m2 && it.m2 < minArea) return false
    if (minRooms && typeof it.habitaciones==='number' && it.habitaciones < minRooms) return false
    if (maxPrice && it.precio && it.precio > maxPrice) return false
    return Boolean(it.titulo && it.precio)
  })
  // de-dup por URL/ID
  const seen = new Set()
  arr = arr.filter(x=>{
    const k = x.url || x.id
    if (!k) return true
    if (seen.has(k)) return false
    seen.add(k); return true
  })
  return arr.slice(0, limit)
}
