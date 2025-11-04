'use client'

import { useState } from 'react'

type Out = {
  ok: boolean
  estimado: number
  rango_confianza: [number, number]
  precio_m2_zona: number
  p25?: number
  p50?: number
  p75?: number
  comparables: Array<{ precio:number; m2:number; titulo?:string; direccion?:string }>
  note?: string
}

export default function Tasador() {
  const [form, setForm] = useState({
    direccion: 'Av. Precursores 537',
    district: 'Santiago de Surco',
    tipo: 'departamento',
    areaConstruida_m2: 85,
    areaTerreno_m2: 0,
    antiguedad_anos: 10,
    vista_mar: false,
    habitaciones: 2,
    banos: 2,
    estacionamientos: 1,
  })

  const [out, setOut] = useState<Out | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calc = async () => {
    setLoading(true)
    setError(null)
    setOut(null)
    try {
      if (!form.direccion.trim() || !form.areaConstruida_m2) {
        throw new Error('Debes ingresar una dirección y el área construida (m²).')
      }

      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`/api/estimate ${res.status} – ${txt}`)
      }

      const data = (await res.json()) as Out
      if (!data.ok && !('estimado' in data)) throw new Error('Error en la tasación')
      setOut(data)
    } catch (e: any) {
      setError(e?.message || 'Error al calcular la tasación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* FORMULARIO */}
      <div className="card p-5 space-y-4">
        <h1 className="text-xl font-semibold">Tasador de Propiedades 🏡</h1>
        <div className="grid grid-cols-2 gap-3">
          <label className="label col-span-2">
            Dirección
            <input
              className="input"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              placeholder="Ej: Av. Precursores 537"
            />
          </label>

          <label className="label col-span-2">
            Distrito
            <input
              className="input"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              placeholder="Ej: Santiago de Surco"
            />
          </label>

          <label className="label">
            Tipo
            <select
              className="input"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="departamento">Departamento</option>
              <option value="casa">Casa</option>
            </select>
          </label>

          <label className="label">
            Área construida (m²)
            <input
              className="input"
              type="number"
              value={form.areaConstruida_m2}
              onChange={(e) =>
                setForm({ ...form, areaConstruida_m2: Number(e.target.value) })
              }
            />
          </label>

          <label className="label">
            Área terreno (m²) (opcional)
            <input
              className="input"
              type="number"
              value={form.areaTerreno_m2}
              onChange={(e) =>
                setForm({ ...form, areaTerreno_m2: Number(e.target.value) })
              }
            />
          </label>

          <label className="label">
            Antigüedad (años)
            <input
              className="input"
              type="number"
              value={form.antiguedad_anos}
              onChange={(e) =>
                setForm({ ...form, antiguedad_anos: Number(e.target.value) })
              }
            />
          </label>

          <label className="label">
            Habitaciones
            <input
              className="input"
              type="number"
              value={form.habitaciones}
              onChange={(e) =>
                setForm({ ...form, habitaciones: Number(e.target.value) })
              }
            />
          </label>

          <label className="label">
            Baños
            <input
              className="input"
              type="number"
              value={form.banos}
              onChange={(e) =>
                setForm({ ...form, banos: Number(e.target.value) })
              }
            />
          </label>

          <label className="label">
            Estacionamientos
            <input
              className="input"
              type="number"
              value={form.estacionamientos}
              onChange={(e) =>
                setForm({ ...form, estacionamientos: Number(e.target.value) })
              }
            />
          </label>

          <label className="label col-span-2">
            Vista al mar
            <select
              className="input"
              value={String(form.vista_mar)}
              onChange={(e) =>
                setForm({ ...form, vista_mar: e.target.value === 'true' })
              }
            >
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </label>
        </div>

        <button
          className="btn btn-primary mt-3"
          onClick={calc}
          disabled={loading}
        >
          {loading ? 'Calculando...' : 'Calcular valor'}
        </button>

        {error && (
          <div className="text-sm text-red-600 mt-2">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* RESULTADO */}
      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="font-semibold text-lg mb-2">Resultado</h2>

          {!out && !error && (
            <p className="text-sm text-gray-600">
              Completa los datos y presiona <b>Calcular valor</b>.
            </p>
          )}

          {out && (
            <div className="space-y-3 text-sm">
              {out.note && (
                <div className="text-amber-700">⚠ {out.note}</div>
              )}

              <div className="flex flex-wrap gap-2">
                <span className="badge">
                  Estimado: ${out.estimado.toLocaleString()}
                </span>
                <span className="badge">
                  Rango: ${out.rango_confianza[0].toLocaleString()} – $
                  {out.rango_confianza[1].toLocaleString()}
                </span>
                <span className="badge">
                  m² (p25/p50/p75): $
                  {out.p25?.toLocaleString?.() ||
                    out.precio_m2_zona} / $
                  {out.p50?.toLocaleString?.() ||
                    out.precio_m2_zona} / $
                  {out.p75?.toLocaleString?.() ||
                    out.precio_m2_zona}
                </span>
                <span className="badge">
                  Comparables: {out.comparables.length}
                </span>
              </div>

              <ul className="list-disc pl-5 space-y-1">
                {out.comparables.map((c, i) => (
                  <li key={i}>
                    {c.titulo || 'Propiedad comparable'} — {c.m2} m² · $
                    {c.precio.toLocaleString()}
                    {c.direccion ? ` · ${c.direccion}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
