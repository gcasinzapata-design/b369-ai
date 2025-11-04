'use client'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Out = {
  estimado: number
  rango_confianza: [number, number]
  precio_m2_zona: number
  comparables: { id:string; titulo:string; precio:number; m2:number }[]
}

function TasadorInner(){
  const sp = useSearchParams()

  // OBLIGATORIOS: direccion, tipo, area_m2, habitaciones
  // OPCIONALES: antiguedad_anos, vista_mar, banos, estacionamientos
  const [form,setForm] = useState({
    direccion: 'Av. La Paz 123, Miraflores',   // obligatorio
    tipo: 'departamento' as 'departamento' | 'casa', // obligatorio
    area_m2: 85,                                // obligatorio
    habitaciones: 2,                            // obligatorio
    antiguedad_anos: 8,                         // opcional
    vista_mar: true,                            // opcional
    banos: 2,                                   // opcional
    estacionamientos: 1                         // opcional
  })

  const [out,setOut] = useState<Out|null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    setForm(f=>({
      ...f,
      direccion: sp.get('direccion') || f.direccion,
      area_m2: Number(sp.get('area_m2') || f.area_m2) || f.area_m2,
      habitaciones: Number(sp.get('habitaciones') || f.habitaciones) || f.habitaciones
    }))
  },[sp])

  const calc = async ()=>{
    setLoading(true)
    const res = await fetch('/api/estimate', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form)
    })
    const json = await res.json()
    setOut({
      estimado: json.estimado,
      rango_confianza: json.rango_confianza,
      precio_m2_zona: json.precio_m2_zona,
      comparables: json.comparables
    })
    setLoading(false)
  }

  const exportPDF = ()=>{
    if (typeof window === 'undefined') return
    const el = document.getElementById('report'); if(!el) return alert('Nada que exportar')
    const win = window.open('','print'); if(!win) return
    win.document.write('<pre>'+el.innerText+'</pre>'); win.document.close(); win.print(); win.close()
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card p-4 space-y-4">
        <h1 className="text-xl font-semibold">Tasador (por ubicación)</h1>

        {/* OBLIGATORIOS */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-700">Obligatorios</div>
          <div className="grid grid-cols-3 gap-3">
            <label className="label col-span-3">Dirección
              <input className="input" value={form.direccion} onChange={e=>setForm({...form, direccion:e.target.value})}/>
            </label>
            <label className="label">Tipo
              <select className="input" value={form.tipo} onChange={e=>setForm({...form, tipo: e.target.value as any})}>
                <option value="departamento">departamento</option>
                <option value="casa">casa</option>
              </select>
            </label>
            <label className="label">Área (m²)
              <input className="input" type="number" min={10} value={form.area_m2}
                     onChange={e=>setForm({...form, area_m2:Number(e.target.value)})}/>
            </label>
            <label className="label">Habitaciones
              <input className="input" type="number" min={0} value={form.habitaciones}
                     onChange={e=>setForm({...form, habitaciones:Number(e.target.value)})}/>
            </label>
          </div>
        </div>

        {/* OPCIONALES */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-700">Opcionales</div>
          <div className="grid grid-cols-3 gap-3">
            <label className="label">Baños
              <input className="input" type="number" min={0} value={form.banos}
                     onChange={e=>setForm({...form, banos:Number(e.target.value)})}/>
            </label>
            <label className="label">Estac.
              <input className="input" type="number" min={0} value={form.estacionamientos}
                     onChange={e=>setForm({...form, estacionamientos:Number(e.target.value)})}/>
            </label>
            <label className="label">Antigüedad (años)
              <input className="input" type="number" min={0} value={form.antiguedad_anos}
                     onChange={e=>setForm({...form, antiguedad_anos:Number(e.target.value)})}/>
            </label>
            <label className="label col-span-3">Vista al mar
              <select className="input" value={String(form.vista_mar)}
                      onChange={e=>setForm({...form, vista_mar: e.target.value==='true'})}>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={calc} disabled={loading}>
            {loading?'Calculando…':'Calcular valor'}
          </button>
          {out && <button className="btn btn-secondary" onClick={exportPDF}>Exportar PDF</button>}
        </div>
      </div>

      <div className="space-y-3" id="report">
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Resultado</h2>
          {!out && <p className="text-sm text-gray-600">Completa los campos obligatorios y calcula.</p>}
          {out && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="badge">Estimado: {'$'+out.estimado.toLocaleString()}</span>
                <span className="badge">Rango: {'$'+out.rango_confianza[0].toLocaleString()} – {'$'+out.rango_confianza[1].toLocaleString()}</span>
                <span className="badge">Precio m² zona: {'$'+out.precio_m2_zona.toLocaleString()}</span>
                <span className="badge">Comparables: {out.comparables.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Page(){
  return (
    <Suspense fallback={<div className="p-6">Cargando tasador…</div>}>
      <TasadorInner/>
    </Suspense>
  )
}
