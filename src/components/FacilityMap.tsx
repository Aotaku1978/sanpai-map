'use client'
import { useEffect, useRef, useState } from 'react'
import type { PinItem } from '@/app/page'

type Props = { pins: PinItem[]; onSelect: (p: PinItem) => void; panelOpen: boolean }

export default function FacilityMap({ pins, onSelect, panelOpen }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const layerGroupRef = useRef<any>(null)
  const onSelectRef = useRef(onSelect)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => { onSelectRef.current = onSelect })

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current) return
    let cancelled = false

    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)

      const map = L.map(mapRef.current).setView([35.69, 139.69], 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)
      layerGroupRef.current = L.layerGroup().addTo(map)
      mapInstanceRef.current = map
      setMapReady(true)
    })

    return () => {
      cancelled = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      layerGroupRef.current = null
      setMapReady(false)
    }
  }, [])

  // Preserve zoom/center when detail panel opens or closes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current
    const center = map.getCenter()
    const zoom = map.getZoom()
    // Wait for the 0.25s CSS transition to finish before resizing
    const timer = setTimeout(() => {
      map.invalidateSize()
      map.setView(center, zoom, { animate: false })
    }, 280)
    return () => clearTimeout(timer)
  }, [panelOpen, mapReady])

  // Update markers when pins or map readiness changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !layerGroupRef.current) return

    import('leaflet').then((L) => {
      if (!layerGroupRef.current) return
      layerGroupRef.current.clearLayers()

      pins.forEach((p) => {
        const isToku = p.facility.license_type?.includes('特別管理')
        const isSite = p.site !== null
        const color = isToku ? '#7F77DD' : '#1D9E75'
        const stroke = isToku ? '#534AB7' : '#0F6E56'
        const size = isSite ? 22 : 16
        const half = size / 2
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><circle cx='${half}' cy='${half}' r='${half - 2}' fill='${color}' stroke='${stroke}' stroke-width='2'/></svg>`
        const icon = L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [half, half] })
        const marker = L.marker([p.lat, p.lon], { icon })
        marker.on('click', () => onSelectRef.current(p))
        layerGroupRef.current.addLayer(marker)
      })
    })
  }, [pins, mapReady])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
