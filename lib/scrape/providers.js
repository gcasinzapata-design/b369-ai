// lib/scrape/providers.js
import * as cheerio from 'cheerio'

// Helper de fetch con headers
async function fetchHtml(url){
  const r = await fetch(url, {
    headers:{
      'User-Agent': 'Mozilla/5.0 (B369AI; +https://b369-ai.netlify.app)',
      'Accept-Language': 'es-PE,es;q=0.9'
    }
  })
  if(!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`)
  return await r.text()
}

// Normalización mínima por portal
function clean(text){ return (text||'').replace(/\s+/g,' ').trim() }
function parsePrice(txt){
  const m = (txt||'').replace(/[^\d]/g,''); return Number(m||0)
}
function parseNum(txt){
  const m = (txt||'').match(/(\d+([.,]\d+)?)/); return m ? Number(m[1].replace(',','.')) : 0
}

// Stubs (simplificados). Puedes perfeccionarlos con selectores reales.
export async function scrapeUrbania(q){
  // TODO: ajustar query -> URL real de búsqueda en Urbania
  const url = `https://www.urbania.pe/buscar?palabras=${encodeURIComponent(q)}`
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const out = []
  $('.some-card-selector').each((_,el)=>{
    const titulo = clean($(el).find('.title').text())
    const precio = parsePrice($(el).find('.price').text())
    const m2 = parseNum($(el).find('.area').text())
    const direccion = clean($(el).find('.address').text())
    const href = $(el).find('a').attr('href') || ''
    out.push({ titulo, precio, m2, direccion, fuente:'urbania', url: href.startsWith('http')? href : ('https://www.urbania.pe'+href) })
  })
  return out
}
export async function scrapeProperati(q){
  const url = `https://www.properati.com.pe/s/${encodeURIComponent(q)}`
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const out = []
  $('.some-card-selector').each((_,el)=>{
    const titulo = clean($(el).find('.title').text())
    const precio = parsePrice($(el).find('.price').text())
    const m2 = parseNum($(el).find('.area').text())
    const direccion = clean($(el).find('.address').text())
    const href = $(el).find('a').attr('href') || ''
    out.push({ titulo, precio, m2, direccion, fuente:'properati', url: href })
  })
  return out
}
export async function scrapeOLX(q){
  const url = `https://www.olx.com.pe/inmuebles_c363/q-${encodeURIComponent(q)}/`
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const out = []
  $('.some-card-selector').each((_,el)=>{
    const titulo = clean($(el).find('.title').text())
    const precio = parsePrice($(el).find('.price').text())
    const m2 = parseNum($(el).find('.area').text())
    const direccion = clean($(el).find('.address').text())
    const href = $(el).find('a').attr('href') || ''
    out.push({ titulo, precio, m2, direccion, fuente:'olx', url: href })
  })
  return out
}
export async function scrapeBabilonia(q){
  const url = `https://babilonia.pe/buscar?query=${encodeURIComponent(q)}`
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const out = []
  $('.some-card-selector').each((_,el)=>{
    const titulo = clean($(el).find('.title').text())
    const precio = parsePrice($(el).find('.price').text())
    const m2 = parseNum($(el).find('.area').text())
    const direccion = clean($(el).find('.address').text())
    const href = $(el).find('a').attr('href') || ''
    out.push({ titulo, precio, m2, direccion, fuente:'babilonia', url: href })
  })
  return out
}
export async function scrapeAdondevivir(q){
  const url = `https://www.adondevivir.com/buscar/?q=${encodeURIComponent(q)}`
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const out = []
  $('.some-card-selector').each((_,el)=>{
    const titulo = clean($(el).find('.title').text())
    const precio = parsePrice($(el).find('.price').text())
    const m2 = parseNum($(el).find('.area').text())
    const direccion = clean($(el).find('.address').text())
    const href = $(el).find('a').attr('href') || ''
    out.push({ titulo, precio, m2, direccion, fuente:'adondevivir', url: href })
  })
  return out
}

export async function scrapeAll({ q, enable }){
  if(!enable) return []
  // Ejecuta en paralelo; si alguno falla, seguimos con los otros
  const tasks = [
    scrapeUrbania(q),
    scrapeProperati(q),
    scrapeOLX(q),
    scrapeBabilonia(q),
    scrapeAdondevivir(q)
  ]
  const settled = await Promise.allSettled(tasks)
  const merged = []
  for(const s of settled){
    if(s.status==='fulfilled' && Array.isArray(s.value)) merged.push(...s.value)
  }
  return merged
}
