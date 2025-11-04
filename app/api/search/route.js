import { NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'
import { geocode } from '../../../lib/geo.js'
import { normalizeItem } from '../../../lib/normalize.js'

let scrapeAll=null; try{ const m = await import('../../../lib/scrape/providers.js'); scrapeAll=m.scrapeAll }catch{}

const BodySchema = z.object({
  q: z.string().min(2),
  filtros: z.object({
    distrito: z.string().min(3),
    areaMin: z.number().min(10),
    habMin: z.number().min(0).default(0),
    precioMax: z.number().min(0)
  })
})

export async function POST(req){
  try{
    const body = await req.json().catch(()=> ({}))
    const input = BodySchema.parse(body)

    const ENABLE_SCRAPING = String(process.env.ENABLE_SCRAPING || '').toLowerCase() === 'true'
    const q = input.q, filtros = input.filtros

    // 1) Fuente: scraping o mock
    let items = []
    if (ENABLE_SCRAPING && typeof scrapeAll==='function'){
      items = (await scrapeAll({ q, enable:true })) || []
    }else{
      const file = path.join(process.cwd(),'public','mock.json')
      const txt = await fs.readFile(file, 'utf8').catch(()=> '[]')
      items = JSON.parse(txt)
    }

    // 2) Normaliza
    items = (items || []).map(normalizeItem)

    // 3) Geocodifica faltantes (hasta 25)
    const need = items.filter(x=>(!x.lat || !x.lon) && x.direccion).slice(0,25)
    await Promise.allSettled(need.map(async x=>{
      const g = await geocode(x.direccion)
      if(g){ x.lat=g.lat; x.lon=g.lon }
    }))

    // 4) Filtros obligatorios
    const distrito = filtros.distrito.toLowerCase()
    items = items.filter(it=>{
      const okDistrito = it.direccion ? it.direccion.toLowerCase().includes(distrito) : true
      const okArea = it.m2 >= filtros.areaMin
      const okHab = (it.habitaciones||0) >= filtros.habMin
      const okPrecio = it.precio <= filtros.precioMax
      return okDistrito && okArea && okHab && okPrecio
    })

    // 5) Centro
    const withGeo = items.filter(x=>x.lat && x.lon)
    let center = null
    if (withGeo.length){
      const lat = withGeo.reduce((s,x)=>s+x.lat,0)/withGeo.length
      const lon = withGeo.reduce((s,x)=>s+x.lon,0)/withGeo.length
      center = { lat, lon }
    }

    return NextResponse.json({ ok:true, items, center })
  }catch(e){
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:400 })
  }
}
