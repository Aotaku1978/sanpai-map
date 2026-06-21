'use client'
import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { Facility, FacilitySite } from '@/types/facility'

const FacilityMap = dynamic(() => import('@/components/FacilityMap'), { ssr: false })

export type PinItem = {
  pinId: string
  lat: number
  lon: number
  facility: Facility
  site: FacilitySite | null
}

export default function Home() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [sites, setSites] = useState<FacilitySite[]>([])
  const [selected, setSelected] = useState<PinItem | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'sanpai' | 'tokubetsu'>('all')

  useEffect(() => {
    supabase.from('facilities').select('*').then(({ data }) => {
      if (data) setFacilities(data)
    })
    supabase.from('facility_sites').select('*, facilities(*)').then(({ data }) => {
      if (data) setSites(data)
    })
  }, [])

  const facilityMap = useMemo(() => {
    const m = new Map<number, Facility>()
    facilities.forEach(f => m.set(f.id, f))
    return m
  }, [facilities])

  const sitesByFacilityId = useMemo(() => {
    const m = new Map<number, FacilitySite[]>()
    sites.forEach(s => {
      const arr = m.get(s.facility_id) ?? []
      arr.push(s)
      m.set(s.facility_id, arr)
    })
    return m
  }, [sites])

  const pins = useMemo((): PinItem[] => {
    const result: PinItem[] = []

    facilities.forEach(f => {
      const facilSites = sitesByFacilityId.get(f.id)
      if (facilSites && facilSites.length > 0) {
        facilSites.forEach(s => {
          if (s.lat && s.lon) {
            result.push({ pinId: `site-${s.id}`, lat: s.lat, lon: s.lon, facility: f, site: s })
          }
        })
      } else if (f.lat && f.lon) {
        result.push({ pinId: `facility-${f.id}`, lat: f.lat, lon: f.lon, facility: f, site: null })
      }
    })

    return result
  }, [facilities, sitesByFacilityId])

  const filtered = useMemo(() => pins.filter((p) => {
    if (search && !p.facility.name.includes(search)) return false
    if (typeFilter === 'sanpai' && p.facility.license_type?.includes('特別管理')) return false
    if (typeFilter === 'tokubetsu' && !p.facility.license_type?.includes('特別管理')) return false
    return true
  }), [pins, search, typeFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>優良産廃処理業者マップ</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="社名で検索..." style={{ fontSize: 13, padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, width: 180 }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6 }}>
          <option value="all">すべての業種</option>
          <option value="sanpai">産業廃棄物処分業</option>
          <option value="tokubetsu">特別管理産業廃棄物処分業</option>
        </select>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{filtered.length}件表示中</span>
      </header>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1 }}>
          <FacilityMap pins={filtered} onSelect={setSelected} />
        </div>
        <div style={{ width: 260, borderLeft: '1px solid #e5e7eb', overflowY: 'auto', background: '#fff' }}>
          {selected ? (
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{selected.facility.name}</div>
              {selected.site && (
                <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500, marginBottom: 4 }}>
                  🏭 {selected.site.site_name ?? '処理施設'}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                <div>📍 {selected.site?.address ?? selected.facility.address}</div>
                {selected.site?.site_type && <div>🔧 {selected.site.site_type}</div>}
                <div>🔢 {selected.facility.license_no}</div>
                <div>📋 {selected.facility.license_type}</div>
                <div>📅 期限：{selected.facility.expire_date}</div>
                <div>👤 {selected.facility.rep}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 14, fontSize: 12, color: '#9ca3af' }}>
              地図上のピンをクリックすると詳細が表示されます
            </div>
          )}
          <div style={{ borderTop: '1px solid #e5e7eb' }}>
            {filtered.map(p => (
              <div key={p.pinId} onClick={() => setSelected(p)} style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.pinId === p.pinId ? '#f0fdf4' : '#fff', fontSize: 12 }}>
                <div style={{ fontWeight: 500 }}>{p.facility.name}</div>
                {p.site?.site_name && (
                  <div style={{ color: '#1D9E75', fontSize: 11 }}>{p.site.site_name}</div>
                )}
                <div style={{ color: '#6b7280', fontSize: 11 }}>
                  {(p.site?.address ?? p.facility.address)?.replace(/東京都|埼玉県|神奈川県|宮城県|福岡県|大阪府/, '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
