'use client'
import { useEffect, useRef } from 'react'
import type { Facility } from '@/types/facility'

type Props = { facilities: Facility[]; onSelect: (f: Facility) => void }

export default function FacilityMap({ facilities, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return
    import('leaflet').then((L) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)

      const map = L.map(mapRef.current!).setView([35.69, 139.69], 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)
      mapInstanceRef.current = map

      facilities.forEach((f) => {
        if (!f.lat || !f.lon) return
        const isToku = f.license_type?.includes('特別管理')
        const color = isToku ? '#7F77DD' : '#1D9E75'
        const stroke = isToku ? '#534AB7' : '#0F6E56'
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='8' fill='${color}' stroke='${stroke}' stroke-width='2'/></svg>`
        const icon = L.divIcon({ html: svg, className: '', iconSize: [20, 20], iconAnchor: [10, 10] })
        const marker = L.marker([f.lat, f.lon], { icon }).addTo(map)
        marker.on('click', () => onSelect(f))
      })
    })
    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [facilities])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
