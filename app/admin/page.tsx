
'use client'
import { useEffect, useState } from 'react'
import BarChart from '@/components/BarChart'

export default function Admin() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/status').then(r=>r.json()).then(setData).catch(e=>setError(String(e)))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard Admin</h1>
      {error && <div className="text-red-600">{error}</div>}
      {!data && !error && <div>Cargando…</div>}
      {data && (
        <div className="space-y-6">
          <section className="grid md:grid-cols-4 gap-3">
            <div className="stat"><b>Consultas hoy</b><div className="text-2xl">{data.metrics.today_queries}</div></div>
            <div className="stat"><b>Tasaciones hoy</b><div className="text-2xl">{data.metrics.today_estimates}</div></div>
            <div className="stat"><b>Latencia p50</b><div className="text-2xl">{data.metrics.latency_p50_ms} ms</div></div>
            <div className="stat"><b>Errores 5xx</b><div className="text-2xl">{data.metrics.errors_5xx}</div></div>
          </section>
          <section className="card p-4">
            <h2 className="font-semibold mb-2">Distribución precio m²</h2>
            <BarChart data={data.price_m2_hist} />
          </section>
          <section className="card p-4">
            <h2 className="font-semibold mb-2">Fuentes activas</h2>
            <ul className="text-sm grid md:grid-cols-2 gap-2">
              {data.sources.map((s:any,idx:number)=>(
                <li key={idx} className="flex items-center gap-2">
                  <span className="badge">{s.id}</span>
                  <span className={s.status==='ok'?'text-green-600':'text-red-600'}>{s.status}</span>
                  <span className="text-gray-500">· {s.uptime_24h}% uptime</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-4">
            <h2 className="font-semibold mb-2">Actividad reciente</h2>
            <ul className="text-sm list-disc ml-5 space-y-1">
              {data.activity.slice(0,10).map((a:any,idx:number)=>(
                <li key={idx}><b>{a.ts}</b> – {a.type} – {a.summary}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
