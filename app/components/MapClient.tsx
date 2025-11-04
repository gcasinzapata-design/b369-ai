'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Pin = { lat:number; lon:number; label?:string }

export default function MapClient({ pins=[] }: { pins: Pin[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!ref.current) return
    const map = L.map(ref.current).setView(pins[0] ? [pins[0].lat, pins[0].lon] : [-12.121, -77.03], pins[0]?14:12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© OpenStreetMap'
    }).addTo(map)
    pins.forEach(p=>{
      L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.label||'Propiedad')
    })
    return ()=> map.remove()
  },[pins])
  return <div ref={ref} className="w-full h-full rounded-lg overflow-hidden" />
}
