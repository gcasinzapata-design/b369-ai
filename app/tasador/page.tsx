{out && (
  <div className="space-y-2 text-sm">
    <div className="flex flex-wrap gap-2">
      <span className="badge">Estimado: ${out.estimado.toLocaleString()}</span>
      <span className="badge">Rango: ${out.rango_confianza[0].toLocaleString()} – ${out.rango_confianza[1].toLocaleString()}</span>
      <span className="badge">m² (p25/p50/p75): ${out.p25?.toLocaleString?.()||out.precio_m2_zona} / ${out.p50?.toLocaleString?.()||out.precio_m2_zona} / ${out.p75?.toLocaleString?.()||out.precio_m2_zona}</span>
      <span className="badge">Comparables: {out.comparables.length}</span>
    </div>
    ...
  </div>
)}
