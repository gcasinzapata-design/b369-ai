'use client'

import { useEffect, useRef } from 'react'
import type * as LType from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Pin = { lat: number; lon: number; label?: string }

export default function MapClient({ pins = [] }: { pins?: Pin[] }) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LType.Map | null>(null)
  const layerRef = useRef<LType.LayerGroup | null>(null)

  useEffect(() => {
    let L: typeof import('leaflet') | null = null
    let disposed = false

    ;(async () => {
      const mod = await import('leaflet')
      if (disposed) return
      L = mod

      // Inicializa mapa solo una vez
      if (!mapRef.current && mapEl.current) {
        mapRef.current = L.map(mapEl.current, {
          center: [-12.0464, -77.0428], // Centro Lima por defecto
          zoom: 12,
          zoomControl: true
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        }).addTo(mapRef.current)
      }

      // Limpia capa previa de pins
      if (layerRef.current) {
        layerRef.current.remove()
        layerRef.current = null
      }

      if (!mapRef.current) return

      layerRef.current = L.layerGroup().addTo(mapRef.current)

      // Si hay pins, agregamos y ajustamos bounds
      if (pins.length) {
        const bounds: LType.LatLngExpression[] = []
        pins.forEach((p) => {
          const latlng: LType.LatLngExpression = [p.lat, p.lon]
          bounds.push(latlng)
          // circle markers para evitar problemas de iconos
          const marker = L!.circleMarker(latlng, {
            radius: 6,
            color: '#00C2A8',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.7
          })
          if (p.label) marker.bindPopup(p.label)
          marker.addTo(layerRef.current as LType.LayerGroup)
        })
        if (bounds.length >= 2) {
          mapRef.current.fitBounds(bounds as LType.LatLngBoundsExpression, {
            padding: [20, 20]
          })
        } else if (bounds.length === 1) {
          mapRef.current.setView(bounds[0] as LType.LatLngTuple, 15)
        }
      }
    })()

    return () => {
      disposed = true
    }
  }, [pins])

  return (
    <div
      ref={mapEl}
      className="w-full h-[520px] rounded-lg overflow-hidden border"
      aria-label="Mapa de propiedades"
    />
  )
}
