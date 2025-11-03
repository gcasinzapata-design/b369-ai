
import * as cheerio from 'cheerio'
export type Listing = { id:string; titulo:string; precio:number; moneda:'USD'|'PEN'; m2:number; habitaciones:number; lat?:number; lng?:number; url?:string; fotos?:string[]; fuente:string; direccion?:string; distrito?:string }
const ENABLE = (process.env.ENABLE_SCRAPING || 'false').toLowerCase() === 'true'
async function safeFetch(url:string){
  const res = await fetch(url, { headers: { 'User-Agent':'Mozilla/5.0 b369' } })
  if(!res.ok) throw new Error('fetch failed')
  return await res.text()
}
export async function scrapeUrbania(query:string, limit=20): Promise<Listing[]>{ if(!ENABLE) return []; try{
  const q = encodeURIComponent(query || 'departamento miraflores')
  const html = await safeFetch(`https://urbania.pe/buscar?keywords=${q}`)
  const $ = cheerio.load(html)
  const items: Listing[] = []
  $('.posting-card').each((_,el)=>{
    const titulo = $(el).find('.posting-card__title').text().trim()
    const priceTxt = $(el).find('.first-price').text().replace(/[^0-9]/g,'')
    const precio = Number(priceTxt||0)
    const url = 'https://urbania.pe'+($(el).find('a').attr('href')||'')
    const img = $(el).find('img').attr('src')||$(el).find('img').attr('data-src')
    const m2Txt = $(el).find('.main-features__price').text().match(/(\d+)\s?m/)
    const m2 = m2Txt ? Number(m2Txt[1]) : 0
    const habTxt = $(el).find('.main-features').text().match(/(\d+)\s?h/)
    const habitaciones = habTxt ? Number(habTxt[1]) : 0
    if(titulo && precio) items.push({ id:url, titulo, precio, moneda:'USD', m2, habitaciones, url, fotos: img?[img]:[], fuente:'urbania' })
  })
  return items.slice(0, limit)
}catch{return []}}
export async function scrapeADV(query:string, limit=20): Promise<Listing[]>{ if(!ENABLE) return []; try{
  const q = encodeURIComponent(query || 'departamento miraflores')
  const html = await safeFetch(`https://www.adondevivir.com/inmuebles.html?mch=${q}`)
  const $ = cheerio.load(html)
  const items: Listing[] = []
  $('[data-qa="posting PROPERTY"]').each((_,el)=>{
    const titulo = $(el).find('[data-qa="POSTING_CARD_TITLE"]').text().trim()
    const priceTxt = $(el).find('[data-qa="POSTING_CARD_PRICE"]').text().replace(/[^0-9]/g,'')
    const precio = Number(priceTxt||0)
    const url = 'https://www.adondevivir.com'+($(el).find('a').attr('href')||'')
    const img = $(el).find('img').attr('src')||$(el).find('img').attr('data-src')
    const feat = $(el).find('[data-qa="POSTING_CARD_FEATURES"]').text()
    const m2 = Number((feat.match(/(\d+)\s?m/)||[])[1]||0)
    const habitaciones = Number((feat.match(/(\d+)\s?hab/)||[])[1]||0)
    if(titulo && precio) items.push({ id:url, titulo, precio, moneda:'USD', m2, habitaciones, url, fotos: img?[img]:[], fuente:'adondevivir' })
  })
  return items.slice(0, limit)
}catch{return []}}
export async function scrapeOLX(query:string, limit=20): Promise<Listing[]>{ if(!ENABLE) return []; try{
  const q = encodeURIComponent(query || 'departamento miraflores')
  const html = await safeFetch(`https://www.olx.com.pe/inmuebles_c-16/q-${q}`)
  const $ = cheerio.load(html)
  const items: Listing[] = []
  $('li.EIR5N').each((_,el)=>{
    const titulo = $(el).find('span._2tW1I').text().trim() || $(el).find('a').attr('title')
    const priceTxt = $(el).find('span._89yzn').text().replace(/[^0-9]/g,'')
    const precio = Number(priceTxt||0)
    const url = 'https://www.olx.com.pe'+($(el).find('a').attr('href')||'')
    const img = $(el).find('img').attr('src')||$(el).find('img').attr('data-src')
    if(titulo && precio) items.push({ id:url, titulo, precio, moneda:'PEN', m2:0, habitaciones:0, url, fotos: img?[img]:[], fuente:'olx' })
  })
  return items.slice(0, limit)
}catch{return []}}
