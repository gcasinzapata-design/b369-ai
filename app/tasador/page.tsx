'use client'

import { useState } from 'react'

type Out = {
  ok: boolean
  estimado: number
  rango_confianza: [number, number]
  precio_m2_zona: number
  comparables: Array<{ precio:number; m2:number; titulo?:string; direccion?:string }>
}

export default function Tasador(){
  const [form,setForm] = useState({
    direccion:'Av. La Paz 123, Miraflores',
    tipo:'departamento',
    area_m2:85,
    antiguedad_anos:8,
    vista_mar:true,
    habitaciones:2,
    banos:2,
    estacionamientos:1
  })
  const [out,setOut] = useState<Out | null>(null)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState<string | null>(null)

  const calc = async ()=>{
    setLoading(true); setError(null); setOut(null)
    const ctrl = new AbortController()
    const t = setTimeout(()=>ctrl.abort(), 12000)
    try{
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(form),
        signal: ctrl.signal
      })
      if(!res.ok){
        const txt = await res.text()
        throw new Error(`/api/estimate ${res.status} – ${txt}`)
      }
      const data = await res.json() as Out
      if(!data.ok) throw new Error('Estimador respondió error')
      setOut(data)
    }catch(e:any){
      setError(e?.message || 'No se pudo calcular')
    }finally{
      clearTimeout(t)
      setLoading(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card p-4 space-y-3">
        <h1 className="text-xl font-semibold">Tasador (por ubicación)</h1>
        <div className="grid grid-cols-3 gap-3">
          <label className="label col-span-3">Dirección
            <input className="input" value={form.direccion} onChange={e=>setForm({...form, direccion:e.target.value})}/>
          </label>
          <label className="label">Tipo
            <select className="input" value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value})}>
              <option value="departamento">departamento</option><option value="casa">casa</option>
            </select>
          </label>
          <label className="label">Área (m²)
            <input className="input" type="number" value={form.area_m2} onChange={e=>setForm({...form, area_m2:Number(e.target.value)})}/>
          </label>
          <label className="label">Antigüedad
            <input className="input" type="number" value={form.antiguedad_anos} onChange={e=>setForm({...form, antiguedad_anos:Number(e.target.value)})}/>
          </label>
          <label className="label">Habitac.
            <input className="input" type="number" value={form.habitaciones} onChange={e=>setForm({...form, habitaciones:Number(e.target.value)})}/>
          </label>
          <label className="label">Baños
            <input className="input" type="number" value={form.banos} onChange={e=>setForm({...form, banos:Number(e.target.value)})}/>
          </label>
          <label className="label">Estac.
            <input className="input" type="number" value={form.estacionamientos} onChange={e=>setForm({...form, estacionamientos:Number(e.target.value)})}/>
          </label>
          <label className="label col-span-3">Vista al mar
            <select className="input" value={String(form.vista_mar)} onChange={e=>setForm({...form, vista_mar:e.target.value==='true'})}>
              <option value="true">Sí</option><option value="false">No</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={calc} disabled={loading}>{loading?'Calculando…':'Calcular valor'}</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <div className="space-y-3" id="report">
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Resultado</h2>
          {!out && !error && <p className="text-sm text-gray-600">Completa los datos y calcula.</p>}
          {out && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="badge">Estimado: ${out.estimado.toLocaleString()}</span>
                <span className="badge">Rango: ${out.rango_confianza[0].toLocaleString()} – ${out.rango_confianza[1].toLocaleString()}</span>
                <span className="badge">Precio m² zona: ${out.precio_m2_zona.toLocaleString()}</span>
                <span className="badge">Comparables: {out.comparables.length}</span>
              </div>
              <ul className="list-disc pl-5">
                {out.comparables.map((c, i)=>(<li key={i}>{c.titulo || 'Comparable'} — {c.m2} m² · ${c.precio.toLocaleString()}</li>))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
