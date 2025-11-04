// app/components/MapClient.tsx
'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Pin = { lat:number; lon:number; label?:string }

export default function MapClient({ pins=[] }: { pins: Pin[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const map = L.map(ref.current).setView([ -12.0464, -77.0428 ], 12) // Lima
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map)
    pins.forEach(p => {
      if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
        L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.label || '')
      }
    })
    if (pins.length) {
      const grp = L.featureGroup(pins.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(p=>L.marker([p.lat,p.lon])))
      map.fitBounds(grp.getBounds().pad(0.2))
    }
    return () => { map.remove() }
  }, [pins])

  return <div ref={ref} className="w-full h-[520px] rounded-lg overflow-hidden border" />
}
