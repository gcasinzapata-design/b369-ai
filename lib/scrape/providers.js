// lib/scrape/providers.js
import * as cheerio from 'cheerio'
import { politeGet } from './fetch.js'

const clean = (t)=> (t||'').replace(/\s+/g,' ').trim()
const num = (t)=> {
  if(!t) return 0
  const m = (''+t).match(/(\d+(?:[.,]\d+)?)/)
  return m ? Number(m[1].replace(',','.')) : 0
}
const money = (t)=> Number((''+t).replace(/[^\d]/g,'')||0)

// Heurística: intenta varias opciones conocidas; si cambia el portal, usamos plan B por texto.
function extractCards($, selectors){
  for(const s of selectors){
    const cards = $(s)
    if(cards && cards.length) return cards
  }
  return $() // vacío
}

function parseGenericCard($, el){
  const root = $(el)
  const title = clean(root.find('h2,h3,.title,[data-e2e="title"]').first().text()) || clean(root.attr('title'))
  const priceTxt = root.find('.price,[data-e2e="price"],[class*="price"]').first().text()
  const areaTxt = root.find('.area,[class*="m2"],[class*="area"]').first().text()
  const address = clean(root.find('.address,[class*="address"],[data-e2e="address"]').first().text())
  const href = root.find('a').first().attr('href') || ''
  const precio = money(priceTxt)
  let m2 = num(areaTxt)
  if(!m2){
    const body = clean(root.text())
    const m = body.match(/(\d{2,4})\s*(?:m2|m²|metros)/i)
    if(m) m2 = Number(m[1])
  }
  return {
    titulo: title,
    precio,
    m2,
    direccion: address,
    url: href.startsWith('http') ? href : href ? ('https://'+new URL($('.og:url').attr('content')||'https://example.com').host + href) : ''
  }
}

async function scrapeGenericList(url, cardSelectors){
  const html = await politeGet(url)
  const $ = cheerio.load(html)
  const cards = extractCards($, cardSelectors)
  const out = []
  cards.each((_,el)=>{
    const it = parseGenericCard($, el)
    if(it.titulo && it.precio && it.m2){ out.push(it) }
  })
  return out
}

export async function scrapeUrbania(q){
  const url = `https://urbania.pe/buscar?palabras=${encodeURIComponent(q)}`
  const cards = ['article', '[data-e2e="card"]', '.results-list article']
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'urbania' }))
}

export async function scrapeProperati(q){
  const url = `https://www.properati.com.pe/s/${encodeURIComponent(q)}`
  const cards = ['article', '.PropertyCard','[data-testid="card"]']
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'properati' }))
}

export async function scrapeOLX(q){
  const url = `https://www.olx.com.pe/inmuebles_c363/q-${encodeURIComponent(q)}/`
  const cards = ['li','article','.listing-grid ._2K7cJ']
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'olx' }))
}

export async function scrapeBabilonia(q){
  const url = `https://babilonia.pe/buscar?query=${encodeURIComponent(q)}`
  const cards = ['article','.card','.property-card']
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'babilonia' }))
}

export async function scrapeAdondevivir(q){
  const url = `https://www.adondevivir.com/buscar/?q=${encodeURIComponent(q)}`
  const cards = ['article','.ui-card','.posting-card']
  const items = await scrapeGenericList(url, cards)
  return items.map(x=>({ ...x, fuente:'adondevivir' }))
}

export async function scrapeAll({ q, enable=true, providers }){
  if(!enable) return []
  const active = providers?.length
    ? providers
    : [scrapeUrbania, scrapeProperati, scrapeOLX, scrapeBabilonia, scrapeAdondevivir]
  const settled = await Promise.allSettled(active.map(fn=>fn(q)))
  const merged = []
  for(const s of settled){ if(s.status==='fulfilled' && Array.isArray(s.value)) merged.push(...s.value) }
  return merged
}
