'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Pin = { lat:number; lon:number; label?:string }
export default function MapClient({ pins=[], center }:{ pins:Pin[]; center?:{lat:number; lon:number} }){
  const ref = useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!ref.current) return
    const map = L.map(ref.current).setView([center?.lat ?? -12.121, center?.lon ?? -77.03], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© OpenStreetMap'
    }).addTo(map)
    pins.forEach(p=>{
      if(Number.isFinite(p.lat) && Number.isFinite(p.lon)){
        L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.label || '')
      }
    })
    return ()=>{ map.remove() }
  },[pins, center])
  return <div className="w-full h-[520px] rounded-lg overflow-hidden" ref={ref}/>
}
