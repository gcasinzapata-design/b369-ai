'use client'
import { useEffect, useState } from 'react'

type S = { ok:boolean; uptimeSec:number; counts:Record<string,number>; lastErrors:{t:number;type:string;msg:string}[] }

export default function Admin(){
  const [s, setS] = useState<S|null>(null)
  const load = async ()=>{
    const r = await fetch('/api/admin/stats')
    const j = await r.json().catch(()=>null)
    setS(j)
  }
  useEffect(()=>{ load(); const id=setInterval(load, 5000); return ()=>clearInterval(id) },[])
  return (
    <div className="space-y-4">
      <div className="brand-hero">
        <h1 className="text-xl font-semibold">Admin · Salud del sistema</h1>
        <p className="text-sm opacity-80">Búsquedas, tasaciones, errores y uptime.</p>
      </div>

      {!s && <div>Cargando…</div>}
      {s && (
        <>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="stat">Uptime: <b>{s.uptimeSec}s</b></div>
            <div className="stat">Búsquedas: <b>{s.counts.search}</b> (cache: {s.counts.search_cache_hit})</div>
            <div className="stat">Tasaciones: <b>{s.counts.estimate}</b> (sin comps: {s.counts.estimate_no_comps})</div>
          </div>

          <div className="card p-3">
            <h2 className="font-semibold mb-2">Errores recientes</h2>
            {!s.lastErrors.length && <div className="text-sm text-gray-500">Sin errores.</div>}
            {!!s.lastErrors.length && (
              <ul className="text-sm space-y-1">
                {s.lastErrors.map((e,i)=>(
                  <li key={i} className="flex justify-between border-b py-1">
                    <span>{new Date(e.t).toLocaleString()} — {e.type}</span>
                    <span className="text-red-600">{e.msg}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
