'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Pin = { lat:number; lon:number; label?:string }

export default function MapClient({ pins }: { pins: Pin[] }){
  const ref = useRef<HTMLDivElement|null>(null)
  useEffect(()=>{
    if (!ref.current) return
    const map = L.map(ref.current).setView([-12.121, -77.03], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'© OpenStreetMap'
    }).addTo(map)

    const bounds: L.LatLngExpression[] = []

    pins.filter(p=>p.lat && p.lon).forEach(p=>{
      const m = L.marker([p.lat, p.lon]).addTo(map)
      if (p.label) m.bindPopup(p.label)
      bounds.push([p.lat, p.lon])
    })
    if (bounds.length) map.fitBounds(bounds as any, { padding:[20,20] })

    return ()=>{ map.remove() }
  },[pins])
  return <div ref={ref} className="leaflet-container" />
}
