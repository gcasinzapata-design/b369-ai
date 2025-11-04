// lib/scrape/feeds.js
import * as cheerio from 'cheerio'
import { politeGet } from './fetch.js'

const SITEMAPS = [
  // orden de prioridad
  { source:'urbania', url:'https://urbania.pe/sitemap.xml' },
  { source:'adondevivir', url:'https://www.adondevivir.com/sitemap.xml' },
  { source:'babilonia', url:'https://babilonia.pe/sitemap.xml' },
  { source:'olx', url:'https://www.olx.com.pe/sitemap.xml' },
  { source:'properati', url:'https://www.properati.com.pe/sitemap.xml' }
]

const clean = (t)=> (t||'').replace(/\s+/g,' ').trim()
const money = (t)=> Number((''+t).replace(/[^\d]/g,'')||0)
const num = (t)=> {
  if(!t) return 0
  const m = (''+t).match(/(\d+(?:[.,]\d+)?)/)
  return m ? Number(m[1].replace(',','.')) : 0
}

async function parseListingPage(url, source){
  try{
    const html = await politeGet(url)
    const $ = cheerio.load(html)
    // Heurísticas por texto
    const title = clean($('h1,h2,title').first().text())
    const body = clean($('body').text())
    const address = clean($('[class*="address"],[itemprop="address"]').first().text()) || ''
    // M²
    let m2 = 0
    const mM2 = body.match(/(\d{2,4})\s*(?:m²|m2|metros)/i)
    if(mM2) m2 = Number(mM2[1])
    // Precio
    let precio = 0
    const mP = body.match(/S\/\s?[\d.,]+|\$\s?[\d.,]+|USD\s?[\d.,]+/i)
    if(mP) precio = money(mP[0])
    return { titulo:title, precio, moneda:'USD', m2, direccion:address, url, fuente:source }
  }catch{
    return null
  }
}

export async function feedsSearch({ q, limit=40 }){
  // q lo usamos para filtrar por texto en título/url
  const out=[]
  for(const site of SITEMAPS){
    try{
      const xml = await politeGet(site.url)
      const urls = (xml.match(/<loc>(.*?)<\/loc>/g)||[]).map(x=>x.replace(/<\/?loc>/g,''))
      const filtered = urls.filter(u=>{
        const s = (u+' '+site.source).toLowerCase()
        return q.toLowerCase().split(/\s+/).every(tok=> s.includes(tok))
      }).slice(0, limit)
      for(const u of filtered){
        const it = await parseListingPage(u, site.source)
        if(it && it.precio && it.m2) out.push(it)
      }
    }catch{}
  }
  return out
}
