'use client'
import { useEffect, useState } from 'react'

export default function Admin(){
  const [health, setHealth] = useState<any>(null)
  useEffect(()=>{
    Promise.all([
      fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ q:'depa miraflores', minArea:50 })}).then(r=>({search:r.status})).catch(()=>({search:'ERR'})),
      fetch('/api/estimate').then(r=>({estimate:r.status})).catch(()=>({estimate:'ERR'}))
    ]).then(([a,b])=>setHealth({...a,...b, node: process.env.NODE_VERSION || '20'}))
  },[])
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard Admin</h1>
      <div className="grid md:grid-cols-4 gap-3">
        <div className="stat"><b>API /search</b><div className="text-2xl">{health?.search??'-'}</div></div>
        <div className="stat"><b>API /estimate</b><div className="text-2xl">{health?.estimate??'-'}</div></div>
        <div className="stat"><b>Node</b><div className="text-2xl">20</div></div>
        <div className="stat"><b>Scraping</b><div className="text-2xl">{process.env.ENABLE_SCRAPING==='1'?'ON':'OFF'}</div></div>
      </div>
      <p className="text-sm text-gray-600">* Cuando quieras resultados 100% reales desde portales, activo <b>ENABLE_SCRAPING=1</b> y te paso los adapters Urbania/OLX (server-side, sin CORS).</p>
    </div>
  )
}
