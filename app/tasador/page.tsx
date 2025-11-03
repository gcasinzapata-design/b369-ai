'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function median(arr:number[]){
  const s=[...arr].sort((a,b)=>a-b)
  const i=Math.floor(s.length/2)
  return s.length? (s.length%2? s[i] : (s[i-1]+s[i])/2) : 2000
}

export default function Tasador(){
  const sp = useSearchParams()
  const [form,setForm] = useState<any>({
    direccion:'Av. La Paz 123, Miraflores', area_m2:85, tipo:'departamento',
    antiguedad_anos:8, vista_mar:true
  })
  const [out,setOut] = useState<any>(null)

  useEffect(()=>{
    setForm((f:any)=>({
      ...f,
      direccion: sp.get('direccion') || f.direccion,
      area_m2: Number(sp.get('area_m2') || f.area_m2)
    }))
  },[sp])

  const calc = async ()=>{
    const res = await fetch('/mock.json'); const comps = await res.json()
    const precio_m2_zona = Math.round(median(comps.map((c:any)=> c.precio/Math.max(1,c.m2))))
    let mult=1.0; if(form.tipo==='casa') mult+=0.05; if(form.vista_mar) mult+=0.10
    if((form.antiguedad_anos||0)>25) mult-=0.10; if((form.antiguedad_anos||0)<5) mult+=0.05
    const estimado = Math.round(precio_m2_zona*(form.area_m2||80)*mult)
    const rango = Math.round(estimado*0.08)
    setOut({ estimado, rango_confianza:[estimado-rango, estimado+rango], precio_m2_zona, comparables: comps.slice(0,5) })
  }

  const exportPDF = ()=>{
    if (typeof window === 'undefined') return
    const el = document.getElementById('report'); if(!el) return alert('Nada que exportar')
    const win = window.open('','print'); if(!win) return
    win.document.write('<pre>'+el.innerText+'</pre>'); win.document.close(); win.print(); win.close()
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
              <option>departamento</option><option>casa</option>
            </select>
          </label>
          <label className="label">Área (m²)
            <input className="input" type="number" value={form.area_m2} onChange={e=>setForm({...form, area_m2:Number(e.target.value)})}/>
          </label>
          <label className="label">Antigüedad
            <input className="input" type="number" value={form.antiguedad_anos} onChange={e=>setForm({...form, antiguedad_anos:Number(e.target.value)})}/>
          </label>
          <label className="label col-span-3">Vista al mar
            <select className="input" value={String(form.vista_mar)} onChange={e=>setForm({...form, vista_mar:e.target.value==='true'})}>
              <option value="true">Sí</option><option value="false">No</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={calc}>Calcular valor</button>
          {out && <button className="btn btn-secondary" onClick={exportPDF}>Exportar PDF</button>}
        </div>
      </div>

      <div className="space-y-3" id="report">
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Resultado</h2>
          {!out && <p className="text-sm text-gray-600">Completa los datos y calcula.</p>}
          {out && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="badge">Estimado: ${out.estimado.toLocaleString()}</span>
                <span className="badge">Rango: ${out.rango_confianza[0].toLocaleString()} – ${out.rango_confianza[1].toLocaleString()}</span>
                <span className="badge">Precio m² zona: ${out.precio_m2_zona.toLocaleString()}</span>
                <span className="badge">Comparables: {out.comparables.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
