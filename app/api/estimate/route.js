import { z } from 'zod'

// --- helpers ---
async function parseCSV(text){
  const [head,...rows]=text.split(/\r?\n/).filter(Boolean)
  const cols=head.split(',').map(s=>s.trim())
  return rows.map(l=>{
    const vals=[];let c='';let inQ=false
    for(let i=0;i<l.length;i++){const ch=l[i];if(ch=='"'){inQ=!inQ;continue}if(ch==','&&!inQ){vals.push(c);c='';continue}c+=ch}vals.push(c)
    const o={};cols.forEach((c,ix)=>o[c]=vals[ix]?.trim?.());return o
  })
}
function normRow(r){
  const f=k=>r?.[k]??r?.[k?.toUpperCase?.()]??r?.[k?.toLowerCase?.()]
  const n=v=>(v==null||v==='')?undefined:Number(String(v).replace(/[^\d.]/g,''))
  const s=v=>(v==null?undefined:String(v).trim())
  return{
    id:s(f('id'))||s(f('url'))||s(f('titulo')),
    titulo:s(f('titulo')),precio:n(f('precio')),
    moneda:s(f('moneda'))||'USD',
    m2:n(f('m2'))||n(f('area'))||n(f('area_construida')),
    habitaciones:n(f('habitaciones'))||n(f('dormitorios')),
    banos:n(f('banos'))||n(f('baños')),
    estacionamientos:n(f('estacionamientos'))||n(f('cocheras')),
    direccion:s(f('direccion')),
    distrito:(s(f('distrito'))||'').toLowerCase(),
    fuente:(s(f('fuente'))||'').toLowerCase(),
    url:s(f('url')),lat:n(f('lat')),lon:n(f('lon')),
    antiguedad:n(f('antiguedad')),
    tipo:(s(f('tipo'))||'departamento').toLowerCase(),
    area_terreno:n(f('area_terreno'))||n(f('m2_terreno'))
  }
}
let CACHE={ts:0,items:[]}
async function loadListings(){
  const now=Date.now()
  if(now-CACHE.ts<5*60*1000&&CACHE.items.length)return CACHE.items
  const urls=(process.env.LISTINGS_CSV_URL||'').split(',').map(s=>s.trim()).filter(Boolean)
  let all=[]
  for(const u of urls){
    try{
      const res=await fetch(u,{cache:'no-store'})
      const text=await res.text()
      const rows=await parseCSV(text)
      all=all.concat(rows.map(normRow).filter(x=>x.id&&x.precio&&x.m2&&x.url))
    }catch(e){console.warn('CSV fail',u)}
  }
  const seen=new Set();const out=[]
  for(const it of all){const k=it.url||it.id;if(!seen.has(k)){seen.add(k);out.push(it)}}
  CACHE={ts:now,items:out};return out
}
const NOM=process.env.NOMINATIM_URL||'https://nominatim.openstreetmap.org/search'
const UA='b369-ai/1.0 (contact: admin@b369.ai)'
let GC=new Map()
async function geocode(d,a){
  const k=`${d}|${a||''}`.toLowerCase()
  if(GC.has(k))return GC.get(k)
  const res=await fetch(`${NOM}?format=json&limit=1&q=${encodeURIComponent([d,a,'Lima, Peru'].filter(Boolean).join(', '))}`,{headers:{'User-Agent':UA}})
  const js=await res.json();if(!js?.length){GC.set(k,null);return null}
  const out={lat:+js[0].lat,lon:+js[0].lon};GC.set(k,out);return out
}
function hav(l1,o1,l2,o2){function r(d){return d*Math.PI/180}const R=6371;const dL=r(l2-l1),dO=r(o2-o1);const a=Math.sin(dL/2)**2+Math.cos(r(l1))*Math.cos(r(l2))*Math.sin(dO/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function perc(a,p){const s=[...a].sort((x,y)=>x-y);if(!s.length)return 0;return s[Math.floor((p/100)*(s.length-1))]}
// --- /helpers ---

const Schema=z.object({
  direccion:z.string().min(4),
  distrito:z.string().optional(),
  tipo:z.enum(['departamento','casa']).default('departamento'),
  area_m2:z.number().min(10),
  area_terreno_m2:z.number().optional(),
  antiguedad_anos:z.number().optional(),
  vista_mar:z.boolean().optional(),
  habitaciones:z.number().optional(),
  banos:z.number().optional(),
  estacionamientos:z.number().optional()
})

export async function POST(req){
  try{
    const b=await req.json();const i=Schema.parse(b)
    const g=await geocode(i.direccion,i.distrito)
    if(!g)return new Response(JSON.stringify({ok:false,code:'no_geocode'}),{status:200})
    let list=await loadListings()
    for(const it of list){it._d=it.lat&&it.lon?hav(g.lat,g.lon,it.lat,it.lon):9999}
    list.sort((a,b)=>a._d-b._d)
    let c=list.slice(0,200).filter(x=>x.precio&&x.m2&&(x.tipo||'dep')===i.tipo)
    const tol=0.35;c=c.filter(x=>Math.abs(x.m2-i.area_m2)<=i.area_m2*tol)
    const s=(v,x)=>v==null||x==null||Math.abs(x-v)<=1
    c=c.filter(x=>s(i.habitaciones,x.habitaciones)&&s(i.banos,x.banos)&&s(i.estacionamientos,x.estacionamientos))
    if(c.length<25)c=list.slice(0,300).filter(x=>x.precio&&x.m2)
    const pm2=c.map(x=>x.precio/x.m2).filter(Number.isFinite)
    if(pm2.length<15)return new Response(JSON.stringify({ok:false,code:'sin_comparables'}),{status:200})
    const p25=perc(pm2,25),p50=perc(pm2,50),p75=perc(pm2,75)
    let m=1.0
    if(i.tipo==='casa'&&i.area_terreno_m2)m+=0.03
    if(i.vista_mar)m+=0.08
    if(i.antiguedad_anos<5)m+=0.03
    if(i.antiguedad_anos>25)m-=0.06
    const base=p50*i.area_m2,est=Math.round(base*m),r=Math.round(est*0.08)
    const comps=c.slice(0,40).map(x=>({titulo:x.titulo,direccion:x.direccion,m2:x.m2,precio:x.precio,url:x.url,distrito:x.distrito}))
    return new Response(JSON.stringify({ok:true,estimado:est,rango_confianza:[est-r,est+r],precio_m2_zona:Math.round(p50),percentiles:{p25,p50,p75},comparables:comps}),{status:200})
  }catch(e){return new Response(JSON.stringify({ok:false,error:e.message}),{status:200})}
}
