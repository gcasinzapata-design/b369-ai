
'use client'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useState } from 'react'

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
})

function Clicker({onPick}:{onPick:(lat:number,lng:number)=>void}){
  useMapEvents({ click(e){ onPick(e.latlng.lat, e.latlng.lng) } })
  return null
}

export default function MapPicker({lat,lng,onChange}:{lat:number,lng:number,onChange:(lat:number,lng:number)=>void}){
  const [pos, setPos] = useState<[number,number]>([lat,lng])
  const update = (a:number,b:number)=>{ setPos([a,b]); onChange(a,b) }
  return (
    <div className="rounded-lg overflow-hidden border">
      <MapContainer center={pos} zoom={15} style={{height: 320, width: '100%'}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        <Marker position={pos} icon={icon} draggable eventHandlers={{ dragend: (e:any)=>{
          const ll = e.target.getLatLng(); update(ll.lat, ll.lng)
        }}} />
        <Clicker onPick={(a,b)=>update(a,b)} />
      </MapContainer>
    </div>
  )
}
