
'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ReportPDFButton from '@/components/ReportPDFButton'

const Map = dynamic(()=>import('@/components/MapPicker'), { ssr: false })

export default function TasadorLocation() {
  const sp = useSearchParams()
  const [form, setForm] = useState<any>({
    direccion: 'Av. La Paz 123, Miraflores',
    lat: -12.124, lng: -77.03,
    radio_m: 800,
    tipo: 'departamento',
    area_m2: 85, antiguedad_anos: 8, habitaciones: 2, banos: 2, cochera: 1, piso: 7, vista_mar: true
  })
  const [out, setOut] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    const qs = Object.fromEntries(sp.entries())
    const n = (k:string)=> (qs[k]!==undefined ? Number(qs[k]) : undefined)
    setForm(f=>({
      ...f,
      direccion: qs['direccion'] ?? f.direccion,
      tipo: qs['tipo'] ?? f.tipo,
      lat: n('lat') ?? f.lat,
      lng: n('lng') ?? f.lng,
      area_m2: n('area_m2') ?? f.area_m2
    }))
  }, [sp])

  const upd = (k:string, v:any)=> setForm({...form, [k]: v})

  const onSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/estimate/location', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      const data = await res.json()
      setOut(data)
    } finally { setLoading(false) }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card p-4 space-y-3">
        <h1 className="text-xl font-semibold">Tasador (por ubicación)</h1>
        <Map lat={form.lat} lng={form.lng} onChange={(lat:number,lng:number)=>{upd('lat',lat); upd('lng',lng)}} />
        <div className="grid grid-cols-2 gap-3">
          <label className="label">Dirección
            <input className="input" value={form.direccion} onChange={e=>upd('direccion', e.target.value)} />
          </label>
          <label className="label">Radio (m)
            <input className="input" type="number" value={form.radio_m} onChange={e=>upd('radio_m', Number(e.target.value))} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="label">Tipo
            <select className="input" value={form.tipo} onChange={e=>upd('tipo', e.target.value)}>
              <option>departamento</option><option>casa</option>
            </select>
          </label>
          <label className="label">Área (m²)
            <input className="input" type="number" value={form.area_m2} onChange={e=>upd('area_m2', Number(e.target.value))} />
          </label>
          <label className="label">Antigüedad
            <input className="input" type="number" value={form.antiguedad_anos} onChange={e=>upd('antiguedad_anos', Number(e.target.value))} />
          </label>
          <label className="label">Hab.
            <input className="input" type="number" value={form.habitaciones} onChange={e=>upd('habitaciones', Number(e.target.value))} />
          </label>
          <label className="label">Baños
            <input className="input" type="number" value={form.banos} onChange={e=>upd('banos', Number(e.target.value))} />
          </label>
          <label className="label">Cochera
            <input className="input" type="number" value={form.cochera} onChange={e=>upd('cochera', Number(e.target.value))} />
          </label>
          <label className="label col-span-3">Vista al mar
            <select className="input" value={String(form.vista_mar)} onChange={e=>upd('vista_mar', e.target.value==='true')}>
              <option value="true">Sí</option><option value="false">No</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={onSubmit} className="btn btn-primary">{loading?'Calculando…':'Calcular valor'}</button>
          {out && <ReportPDFButton selector="#report" filename="reporte-tasacion.pdf" />}
        </div>
      </div>

      <div className="space-y-3" id="report">
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Resultado</h2>
          {!out && <p className="text-sm text-gray-600">Mueve el pin o ajusta los datos y calcula.</p>}
          {out && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="badge">Estimado: ${out.estimado?.toLocaleString?.() ?? out.estimado}</span>
                <span className="badge">Rango: ${out.rango_confianza[0].toLocaleString()} – ${out.rango_confianza[1].toLocaleString()}</span>
                <span className="badge">Precio m² zona: ${out.precio_m2_zona}</span>
                <span className="badge">Comparables: {out.comparables?.length}</span>
              </div>
              <div className="grid gap-2">
                {out.comparables?.map((c:any,idx:number)=>(
                  <div key={idx} className="text-xs flex items-center justify-between border rounded p-2">
                    <span>Comp #{idx+1} · {c.m2} m² · {c.dist_m} m</span>
                    <a className="text-blue-600" href={c.url} target="_blank">${c.precio.toLocaleString()}</a>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500">Lógica: {JSON.stringify(out.logica)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
