'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Pin = { lat:number; lon:number; label?:string }
export default function MapClient({ center, pins }:{ center: {lat:number;lon:number}|null, pins:Pin[] }){
  const ref = useRef<HTMLDivElement|null>(null)
  useEffect(()=>{
    if(!ref.current) return
    const map = L.map(ref.current).setView(center? [center.lat, center.lon] : [-12.121, -77.03], center? 13:12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19 }).addTo(map)
    pins.forEach(p=> L.marker([p.lat,p.lon]).addTo(map).bindPopup(p.label||'Propiedad'))
    return ()=>{ map.remove() }
  },[center, pins])
  return <div ref={ref} className="w-full h-full rounded-lg overflow-hidden"/>
}
