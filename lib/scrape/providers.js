// lib/scrape/providers.js
import * as cheerio from 'cheerio'
import { politeGet } from './fetch.js'

const clean = (t)=> (t||'').replace(/\s+/g,' ').trim()
const money = (t)=> Number((''+t).replace(/[^\d]/g,'')||0)
const num = (t)=> {
  if(!t) return 0
  const m = (''+t).match(/(\d+(?:[.,]\d+)?)/)
  return m ? Number(m[1].replace(',','.')) : 0
}
const absUrl = (href, base) => {
  try{
    if(!href) return ''
    if(href.startsWith('http')) return href
    const u = new URL(base)
    if(href.startsWith('/')) return `${u.origin}${href}`
    return `${u.origin}/${href}`
  }catch{ return href || '' }
}

// Generic extractor (por si cambia el HTML)
function parseGenericCard($, el, base){
  const root = $(el)
  const title = clean(root.find('h2,h3,.title,[data-e2e="title"]').first().text()) || clean(root.attr('title'))
  const priceTxt = root.find('.price,[data-e2e="price"],[class*="price"]').first().text()
  const areaTxt = root.find('.area,[class*="m2"],[class*="area"]').first().text()
  const address = clean(root.find('.address,[class*="address"],[data-e2e="address"]').first().text())
  const href = root.find('a').first().attr('href') || ''
  let m2 = num(areaTxt)
  if(!m2){
    const body = clean(root.text())
    const m = body.match(/(\d{2,4})\s*(?:m2|m²|metros)/i)
    if(m) m2 = Number(m[1])
  }
  return {
    titulo: title,
    precio: money(priceTxt),
    m2,
    direccion: address,
    url: absUrl(href, base)
  }
}

async function scrapeGenericList(url, cardSelectors){
  const html = await politeGet(url)
  const $ = cheerio.load(html)
  let cards = $()
  for(const s of cardSelectors){
    cards = $(s)
    if(cards.length) break
  }
  const out=[]
  cards.each((_,el)=>{
    const it = parseGenericCard($, el, url)
    if(it.titulo && it.precio && it.m2){ out.push(it) }
  })
  return out
}

/** URBANIA (prioridad 1) */
export async function scrapeUrbania(q){
  // Búsqueda por palabras
  const url = `https://urbania.pe/buscar?palabras=${encodeURIComponent(q)}`
  // Selectores observados + fallbacks
  const cards = [
    'article[data-e2e="posting-card"]',
    'article[data-e2e="card"]',
    'article'
  ]
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'urbania' }))
}

/** ADONDEVIVIR (prioridad 2) */
export async function scrapeAdondevivir(q){
  const url = `https://www.adondevivir.com/buscar/?q=${encodeURIComponent(q)}`
  const cards = [
    'article.ui-card',
    'div.posting-card',
    'article'
  ]
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'adondevivir' }))
}

/** BABILONIA (prioridad 3) */
export async function scrapeBabilonia(q){
  const url = `https://babilonia.pe/buscar?query=${encodeURIComponent(q)}`
  const cards = [
    'article.property-card',
    'div.card',
    'article'
  ]
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'babilonia' }))
}

/** OLX (prioridad 4) */
export async function scrapeOLX(q){
  const url = `https://www.olx.com.pe/inmuebles_c363/q-${encodeURIComponent(q)}/`
  const cards = [
    'li[data-aut-id="itemBox"]',
    'article',
    'li'
  ]
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'olx' }))
}

/** PROPERATI (prioridad 5) */
export async function scrapeProperati(q){
  const url = `https://www.properati.com.pe/s/${encodeURIComponent(q)}`
  const cards = [
    'article[data-testid="property-card"]',
    '.PropertyCard',
    'article'
  ]
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'properati' }))
}

/** Agregador con prioridad fija */
export async function scrapeAll({ q, enable=true, limitPerSite=40 }){
  if(!enable) return []
  const order = [
    scrapeUrbania,
    scrapeAdondevivir,
    scrapeBabilonia,
    scrapeOLX,
    scrapeProperati
  ]
  const results = []
  for(const fn of order){
    try{
      const chunk = await fn(q)
      results.push(...(chunk||[]).slice(0, limitPerSite))
    }catch{}
  }
  return results
}
