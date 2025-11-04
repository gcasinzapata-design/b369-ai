import { NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'
import { geocode } from '../../../lib/geo.js'
import { normalizeItem } from '../../../lib/normalize.js'
import { logEvent } from '../../../lib/stats.js'

let scrapeAll=null; try{ const m = await import('../../../lib/scrape/providers.js'); scrapeAll=m.scrapeAll }catch{}
let feedsSearch=null; try{ const m = await import('../../../lib/scrape/feeds.js'); feedsSearch=m.feedsSearch }catch{}

const BodySchema = z.object({
  q: z.string().min(2),
  filtros: z.object({
    distrito: z.string().min(3),
    areaMin: z.number().min(10),
    habMin: z.number().min(0).default(0),
    precioMax: z.number().min(0)
  })
})

const memCache = new Map() // key -> { ts, data }

export async function POST(req){
  const started = Date.now()
  try{
    const body = await req.json().catch(()=> ({}))
    const input = BodySchema.parse(body)

    const ENABLE_SCRAPING = String(process.env.ENABLE_SCRAPING || '').toLowerCase() === 'true'
    const FEEDS_MODE = String(process.env.FEEDS_MODE || '').toLowerCase() === 'true'
    const FEEDS_LIMIT = Number(process.env.FEEDS_LIMIT || 40)

    const key = JSON.stringify(input)
    const hit = memCache.get(key)
    if(hit && (Date.now()-hit.ts)< 5*60_000){ // 5 min
      await logEvent('search_cache_hit', { tookMs: Date.now()-started })
      return NextResponse.json({ ok:true, ...hit.data })
    }

    const { q, filtros } = input
    let items = []

    if (FEEDS_MODE && typeof feedsSearch==='function'){
      items = await feedsSearch({ q, limit: FEEDS_LIMIT })
    } else if (ENABLE_SCRAPING && typeof scrapeAll==='function'){
      items = await scrapeAll({ q, enable:true, limitPerSite: FEEDS_LIMIT })
    } else {
      const file = path.join(process.cwd(),'public','mock.json')
      const txt = await fs.readFile(file, 'utf8').catch(()=> '[]')
      items = JSON.parse(txt)
    }

    // Normaliza
    items = (items||[]).map(normalizeItem)

    // Geocodifica faltantes (hasta 25)
    const need = items.filter(x=>(!x.lat || !x.lon) && x.direccion).slice(0,25)
    await Promise.allSettled(need.map(async x=>{
      const g = await geocode(x.direccion)
      if(g){ x.lat=g.lat; x.lon=g.lon }
    }))

    // Filtros obligatorios
    const distrito = filtros.distrito.toLowerCase()
    items = items.filter(it=>{
      const okDistrito = it.direccion ? it.direccion.toLowerCase().includes(distrito) : true
      const okArea = it.m2 >= filtros.areaMin
      const okHab = (it.habitaciones||0) >= filtros.habMin
      const okPrecio = it.precio <= filtros.precioMax
      return okDistrito && okArea && okHab && okPrecio
    })

    // Centro
    const withGeo = items.filter(x=>x.lat && x.lon)
    let center = null
    if (withGeo.length){
      const lat = withGeo.reduce((s,x)=>s+x.lat,0)/withGeo.length
      const lon = withGeo.reduce((s,x)=>s+x.lon,0)/withGeo.length
      center = { lat, lon }
    }

    const data = { items, center }
    memCache.set(key, { ts: Date.now(), data })
    await logEvent('search', { tookMs: Date.now()-started, count: items.length, mode: FEEDS_MODE?'feeds':'scrape' })
    return NextResponse.json({ ok:true, ...data })
  }catch(e){
    await logEvent('search_error', { tookMs: Date.now()-started, error: String(e?.message||e) })
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:400 })
  }
}
