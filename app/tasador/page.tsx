'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Out = {
  ok: boolean
  input: any
  precio_m2_base: number
  multiplicador: number
  estimado: number
  rango_confianza: [number, number]
  comparables: any[]
}

function Badge({children}:{children: React.ReactNode}) {
  return <span className="badge">{children}</span>
}

export default function TasadorPage(){
  return (
    <Suspense fallback={<div className="p-4">Cargando tasador…</div>}>
      <TasadorClient/>
    </Suspense>
  )
}

function TasadorClient(){
  const sp = useSearchParams()
  const [form,setForm] = useState<any>({
    direccion: 'Miraflores',
    tipo: 'departamento',
    area_m2: Number(sp.get('area_m2') || 80),
    antiguedad_anos: 8,
    vista_mar: false,
    habitaciones: Number(sp.get('habitaciones') || 2),
    banos: 2,
    estacionamientos: 1
  })
  const [out,setOut] = useState<Out|null>(null)
  const [error,setError] = useState<string|undefined>(undefined)
  const [busy,setBusy] = useState(false)

  useEffect(()=>{
    const d = sp.get('direccion'); const a = sp.get('area_m2'); const h = sp.get('habitaciones')
    setForm((f:any)=>({
      ...f,
      direccion: d || f.direccion,
      area_m2: a ? Number(a) : f.area_m2,
      habitaciones: h ? Number(h) : f.habitaciones
    }))
  },[sp])

  const calc = async ()=>{
    setBusy(true); setError(undefined); setOut(null)
    try{
      const res = await fetch('/api/estimate',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      if(!res.ok) throw new Error('API estimate no respondió OK')
      const json = await res.json()
      setOut(json)
    }catch(e:any){
      setError(e?.message || 'Error inesperado')
    }finally{
      setBusy(false)
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
              <option value="departamento">Departamento</option>
              <option value="casa">Casa</option>
            </select>
          </label>

          <label className="label">Área (m²)
            <input className="input" type="number" value={form.area_m2} onChange={e=>setForm({...form, area_m2:Number(e.target.value)})}/>
          </label>

          <label className="label">Antigüedad (años)
            <input className="input" type="number" value={form.antiguedad_anos} onChange={e=>setForm({...form, antiguedad_anos:Number(e.target.value)})}/>
          </label>

          <label className="label">Vista al mar
            <select className="input" value={String(form.vista_mar)} onChange={e=>setForm({...form, vista_mar:e.target.value==='true'})}>
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </label>

          <label className="label">Habitaciones
            <input className="input" type="number" value={form.habitaciones} onChange={e=>setForm({...form, habitaciones:Number(e.target.value)})}/>
          </label>

          <label className="label">Baños
            <input className="input" type="number" value={form.banos} onChange={e=>setForm({...form, banos:Number(e.target.value)})}/>
          </label>

          <label className="label">Estac.
            <input className="input" type="number" value={form.estacionamientos} onChange={e=>setForm({...form, estacionamientos:Number(e.target.value)})}/>
          </label>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={calc} disabled={busy}>{busy? 'Calculando…' : 'Calcular valor'}</button>
        </div>

        {error && <div className="text-sm text-red-600">⚠ {error}</div>}
      </div>

      <div className="space-y-3" id="report">
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Resultado</h2>
          {!out && !error && <p className="text-sm text-gray-600">Completa los datos y presiona “Calcular valor”.</p>}
          {out && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge>Estimado: ${out.estimado.toLocaleString()}</Badge>
                <Badge>Rango: ${out.rango_confianza[0].toLocaleString()} – ${out.rango_confianza[1].toLocaleString()}</Badge>
                <Badge>Precio m² base: ${out.precio_m2_base.toLocaleString()}</Badge>
                <Badge>Multiplicador: {out.multiplicador.toFixed(2)}x</Badge>
                <Badge>Comparables: {out.comparables.length}</Badge>
              </div>
              <div className="mt-2">
                <b>Comparables (top 5)</b>
                <ul className="list-disc ml-5">
                  {out.comparables.map((c,i)=>(
                    <li key={i}>{c.titulo} — {c.m2} m² · ${c.precio.toLocaleString()}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
