
'use client'
type Item={ label:string, value:number }
export default function BarChart({data}:{data:Item[]}){
  const max = Math.max(...data.map(d=>d.value), 1)
  const height = 140
  const barW = 32
  const gap = 12
  const width = data.length*(barW+gap)+gap
  return (
    <svg width={width} height={height} role="img" aria-label="Distribución de precios m²">
      {data.map((d,i)=>{
        const h = Math.round((d.value/max)*(height-24))
        const x = gap + i*(barW+gap)
        const y = height - h - 20
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="6" fill="#8d9dbf" />
            <text x={x+barW/2} y={height-6} textAnchor="middle" fontSize="10" fill="#374151">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
