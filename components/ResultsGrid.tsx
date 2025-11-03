
'use client'
import Link from 'next/link'

type Listing = { id:string, titulo:string, precio:number, moneda:string, m2:number, habitaciones:number, direccion?:string, distrito?:string, fotos?:string[], fuente?:string, url?:string, lat?:number, lng?:number, tipo?:string }

function buildTasadorURL(it: Listing){
  const params = new URLSearchParams()
  if(it.lat!==undefined) params.set('lat', String(it.lat))
  if(it.lng!==undefined) params.set('lng', String(it.lng))
  if(it.m2!==undefined) params.set('area_m2', String(it.m2))
  if(it.titulo) params.set('direccion', it.titulo)
  if(it.tipo) params.set('tipo', it.tipo)
  return `/tasador?${params.toString()}`
}

export default function ResultsGrid({items}:{items:Listing[]}){
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((it,idx)=> (
        <article key={it.id || idx} className="card overflow-hidden">
          <img src={it.fotos?.[0] || `https://picsum.photos/seed/${idx}/600/400`} alt={it.titulo} className="h-44 w-full object-cover" />
          <div className="p-3 space-y-2">
            <div>
              <h3 className="font-semibold line-clamp-1">{it.titulo}</h3>
              <p className="text-sm text-gray-600">{it.direccion || it.distrito}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">{it.moneda==='USD'?'$':'S/ '}{(it.precio||0).toLocaleString()}</span>
              <span className="text-sm">{it.m2} m² · {it.habitaciones} hab</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="badge">{(it.fuente||'web').toUpperCase()}</span>
              <div className="flex gap-2">
                {it.url && <a href={it.url} target="_blank" className="text-blue-600">Anuncio →</a>}
                <Link href={buildTasadorURL(it)} className="text-emerald-700">Tasar →</Link>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
