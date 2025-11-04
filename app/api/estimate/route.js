// app/api/estimate/route.js
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { geocode, haversine, percentile, median } from '../../../lib/geo.js'
import { normalizeItem } from '../../../lib/normalize.js'
import { logEvent } from '../../../lib/stats.js'

let scrapeAll=null; try{ const m = await import('../../../lib/scrape/providers.js'); scrapeAll=m.scrapeAll }catch{}
let feedsSearch=null; try{ const m = await import('../../../lib/scrape/feeds.js'); feedsSearch=m.feedsSearch }catch{}

const Body = z.object({
  direccion: z.string().min(5),
  tipo: z.enum(['departamento','casa']),
  areaConstruida_m2: z.number().min(20),     // OBLIGATORIO
  areaTerreno_m2: z.number().min(0).optional(),
  antiguedad_anos: z.number().min(0).max(120).optional(),
  vista_mar: z.boolean().optional(),
  habitaciones: z.number().min(0).optional(),
  banos: z.number().min(0).optional(),
  estacionamientos: z.number().min(0).optional()
})

export async function POST(req){
  const started = Date.now()
  try{
    const input = Body.parse(await req.json())
    const FEEDS_MODE = String(process.env.FEEDS_MODE || 'true').toLowerCase() === 'true'
    const ENABLE_SCRAPING = String(process.env.ENABLE_SCRAPING || '').toLowerCase() === 'true'
    const FEEDS_LIMIT = Number(process.env.FEEDS_LIMIT || 40)

    const g = await geocode(input.direccion)
    if(!g) throw new Error('No se pudo geocodificar la dirección')

    let q = `${input.tipo} ${input.habitaciones||''} hab ${input.direccion}`
    let comps = []
    if (FEEDS_MODE && typeof feedsSearch==='function'){
      comps = await feedsSearch({ q, limit: FEEDS_LIMIT })
    } else if (ENABLE_SCRAPING && typeof scrapeAll==='function'){
      comps = await scrapeAll({ q, enable:true, limitPerSite: FEEDS_LIMIT })
    } else {
      comps = []
    }
    comps = (comps||[]).map(normalizeItem)

    const subj = { lat:g.lat, lon:g.lon }
    const withGeo = comps.filter(c=>c.lat && c.lon).map(c=>({ ...c, distKm: haversine(subj, {lat:c.lat, lon:c.lon}) }))

    const similar = withGeo.filter(c=>{
      const areaOk = c.m2>0 && Math.abs(c.m2 - input.areaConstruida_m2)/input.areaConstruida_m2 <= 0.25
      return areaOk && c.distKm <= 5
    })
    let pool = similar.length ? similar : withGeo
    pool = pool.sort((a,b)=>a.distKm-b.distKm).slice(0,60)

    const pM2 = pool.map(c=> c.precio>0 && c.m2>0 ? c.precio/c.m2 : 0).filter(x=>x>0)
    if(!pM2.length){
      await logEvent('estimate_no_comps', { tookMs: Date.now()-started })
      return NextResponse.json({ ok:false, error:'Sin comparables suficientes' }, { status:200 })
    }
    const p10 = percentile(pM2, 0.10), p90 = percentile(pM2, 0.90)
    const clean = pM2.filter(x=>x>=p10 && x<=p90)
    let base = median(clean)
    if(!Number.isFinite(base) || base<=0) base = median(pM2)

    let adj = 1.0
    if(input.tipo==='casa' && input.areaTerreno_m2 && input.areaTerreno_m2> input.areaConstruida_m2) adj += 0.03
    if(input.vista_mar) adj += 0.08
    if((input.antiguedad_anos||0)<5) adj += 0.03
    if((input.antiguedad_anos||0)>25) adj -= 0.07
    if((input.habitaciones||0)>3) adj += 0.02
    if((input.estacionamientos||0)>1) adj += 0.02

    const precio_m2_zona = Math.round(base*adj)
    const estimado = Math.round(precio_m2_zona * input.areaConstruida_m2)
    const rango = Math.round(estimado*0.10)

    const comparables = pool.slice(0,12).map(c=>({
      titulo: c.titulo, precio: c.precio, m2: c.m2, direccion: c.direccion, url: c.url
    }))

    await logEvent('estimate', { tookMs: Date.now()-started, comps: pool.length, pM2: precio_m2_zona })
    return NextResponse.json({
      ok:true,
      estimado,
      rango_confianza:[estimado-rango, estimado+rango],
      precio_m2_zona,
      comparables
    })
  }catch(e){
    await logEvent('estimate_error', { tookMs: Date.now()-started, error:String(e?.message||e) })
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:200 })
  }
}
