
import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { logActivity, logMetric } from '../_telemetry'
import { scrapeUrbania, scrapeADV, scrapeOLX } from '../_adapters/scrape'

type Listing = { id:string; titulo:string; precio:number; moneda:'USD'|'PEN'; m2:number; habitaciones:number; lat?:number; lng?:number; url?:string; fotos?:string[]; fuente:string; direccion?:string; distrito?:string }

function norm(l:Listing):Listing{ return { ...l, titulo: l.titulo?.trim()||'Propiedad', fotos: l.fotos||[], moneda: l.moneda||'USD' } }
function dedupe(items:Listing[]):Listing[]{
  const seen = new Set<string>(); const out:Listing[] = []
  for(const it of items){
    const key = `${(it.titulo||'').toLowerCase().slice(0,32)}|${Math.round((it.precio||0)/1000)}|${Math.round(it.m2||0)}`
    if(!seen.has(key)){ seen.add(key); out.push(it) }
  }
  return out
}

export async function POST(req: Request){
  const t0 = Date.now()
  const body = await req.json().catch(()=>({}))
  const q = body.q || ''
  const filters = body.filters || {}
  const page = body.page || 1
  const page_size = body.page_size || 20

  let merged: Listing[] = []
  try{
    const [u,a,o] = await Promise.all([scrapeUrbania(q, page_size), scrapeADV(q, page_size), scrapeOLX(q, page_size)])
    merged = [...u, ...a, ...o].map(norm)
  }catch{
    merged = []
  }

  if(merged.length===0){
    const file = path.join(process.cwd(), 'data', 'listings.sample.json')
    const raw = await fs.readFile(file, 'utf-8')
    const all = JSON.parse(raw)
    merged = all
  }

  let out = merged
  if (filters?.distritos?.length){
    out = out.filter((x:any)=> (x.distrito||'miraflores').toLowerCase().includes(String(filters.distritos[0]).toLowerCase()))
  }
  if (q){
    const s = String(q).toLowerCase()
    out = out.filter((x:any)=> [x.titulo,x.direccion].join(' ').toLowerCase().includes(s))
  }

  out = dedupe(out)
  const total = out.length
  const r = out.slice((page-1)*page_size, page*page_size)

  const latency = Date.now()-t0
  logMetric('search', latency)
  logActivity('search', `page ${page} • ${total} resultados`)
  return NextResponse.json({ results: r, page, total, served_from_cache: merged.length===0 })
}
