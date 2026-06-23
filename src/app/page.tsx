'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
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

type ProcessingCapacity = {
  id: number
  facility_site_id: number
  waste_type: string
  facility_sites?: { facility_id: number }
}

type DetailCapacity = {
  id: number
  facility_site_id: number
  waste_type: string
  capacity_value: number | null
  capacity_unit: string | null
  process_type: string | null
}

const WASTE_TYPES = [
  '廃プラスチック類',
  '金属くず',
  '紙くず',
  '木くず',
  '繊維くず',
  'ガラスくず・コンクリートくず',
  'がれき類',
  '廃油',
  '汚泥',
  '感染性廃棄物',
]

const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 11,
  padding: '3px 10px',
  borderRadius: 20,
  cursor: 'pointer',
  userSelect: 'none',
  border: active ? '1px solid #0F6E56' : '1px solid #d1d5db',
  background: active ? '#1D9E75' : '#f9fafb',
  color: active ? '#fff' : '#374151',
  whiteSpace: 'nowrap',
})

export default function Home() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [sites, setSites] = useState<FacilitySite[]>([])
  const [capacities, setCapacities] = useState<ProcessingCapacity[]>([])
  const [selected, setSelected] = useState<PinItem | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'sanpai' | 'tokubetsu'>('all')
  const [selectedWastes, setSelectedWastes] = useState<string[]>([])
  const [focusedFacilityId, setFocusedFacilityId] = useState<number | null>(null)
  const [detailCapacities, setDetailCapacities] = useState<DetailCapacity[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (!selected) return
    itemRefs.current.get(selected.pinId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  useEffect(() => {
    if (!selected?.site) {
      setDetailCapacities([])
      return
    }
    setDetailLoading(true)
    supabase
      .from('processing_capacities')
      .select('*')
      .eq('facility_site_id', selected.site.id)
      .then(({ data }) => {
        setDetailCapacities(data ?? [])
        setDetailLoading(false)
      })
  }, [selected])

  useEffect(() => {
    supabase.from('facilities').select('*').then(({ data }) => {
      if (data) setFacilities(data)
    })
    supabase.from('facility_sites').select('*, facilities(*)').then(({ data }) => {
      if (data) setSites(data)
    })
    supabase.from('processing_capacities').select('*, facility_sites(facility_id)').then(({ data }) => {
      if (data) setCapacities(data)
    })
  }, [])

  const toggleWaste = (type: string) => {
    setSelectedWastes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const sitesByFacilityId = useMemo(() => {
    const m = new Map<number, FacilitySite[]>()
    sites.forEach(s => {
      const arr = m.get(s.facility_id) ?? []
      arr.push(s)
      m.set(s.facility_id, arr)
    })
    return m
  }, [sites])

  const qualifyingSiteIds = useMemo(() => {
    if (selectedWastes.length === 0) return null
    const result = new Set<number>()
    capacities.forEach(c => {
      if (selectedWastes.includes(c.waste_type)) {
        result.add(c.facility_site_id)
      }
    })
    return result
  }, [capacities, selectedWastes])

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

  const displayPins = useMemo(() => {
    if (focusedFacilityId === null) return pins
    return pins.filter(p => p.facility.id === focusedFacilityId)
  }, [pins, focusedFacilityId])

  const filtered = useMemo(() => displayPins.filter((p) => {
    if (search && !p.facility.name.includes(search)) return false
    if (typeFilter === 'sanpai' && p.facility.license_type?.includes('特別管理')) return false
    if (typeFilter === 'tokubetsu' && !p.facility.license_type?.includes('特別管理')) return false
    if (qualifyingSiteIds !== null) {
      // siteがある場合はsite_idで判定、siteがない（本社ピン）場合は除外しない
      if (p.site && !qualifyingSiteIds.has(p.site.id)) return false
    }
    return true
  }), [displayPins, search, typeFilter, qualifyingSiteIds])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '1px solid #e5e7eb', background: '#fff', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, whiteSpace: 'nowrap' }}>優良産廃処理業者マップ</h1>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="社名で検索..."
            style={{ fontSize: 13, padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, width: 180 }}
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6 }}
          >
            <option value="all">すべての業種</option>
            <option value="sanpai">産業廃棄物処分業</option>
            <option value="tokubetsu">特別管理産業廃棄物処分業</option>
          </select>
          <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{filtered.length}件表示中</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>受入品目：</span>
          {WASTE_TYPES.map(type => (
            <span key={type} style={chip(selectedWastes.includes(type))} onClick={() => toggleWaste(type)}>
              {type}
            </span>
          ))}
          {selectedWastes.length > 0 && (
            <span
              style={{ fontSize: 11, color: '#6b7280', cursor: 'pointer', textDecoration: 'underline', marginLeft: 4 }}
              onClick={() => setSelectedWastes([])}
            >
              クリア
            </span>
          )}
        </div>
      </header>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1 }}>
          <FacilityMap pins={filtered} onSelect={setSelected} />
        </div>
        <div style={{ width: 260, borderLeft: '1px solid #e5e7eb', overflowY: 'auto', background: '#fff' }}>
          <div style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>
            ピンまたは施設名をクリックして詳細を表示
          </div>
          {focusedFacilityId !== null && (
            <div
              style={{ padding: '6px 14px', fontSize: 11, color: '#1D9E75', borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: '#f0fdf4' }}
              onClick={() => setFocusedFacilityId(null)}
            >
              ✕ 絞り込み解除（全件表示）
            </div>
          )}
          <div style={{ borderTop: '1px solid #e5e7eb' }}>
            {filtered.map(p => {
              const isFocused = focusedFacilityId === p.facility.id
              const isSelected = selected?.pinId === p.pinId
              return (
                <div
                  key={p.pinId}
                  ref={(el) => {
                    if (el) itemRefs.current.set(p.pinId, el)
                    else itemRefs.current.delete(p.pinId)
                  }}
                  onClick={() => {
                    setSelected(p)
                    setFocusedFacilityId(prev => prev === p.facility.id ? null : p.facility.id)
                  }}
                  style={{
                    padding: '8px 14px',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: isSelected ? '#dcfce7' : isFocused ? '#f0fdf4' : '#fff',
                    fontSize: 12,
                    borderLeft: isSelected ? '3px solid #1D9E75' : isFocused ? '3px solid #1D9E75' : '3px solid transparent',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{p.facility.name}</div>
                  {p.site?.site_name && (
                    <div style={{ color: '#1D9E75', fontSize: 11 }}>{p.site.site_name}</div>
                  )}
                  <div style={{ color: '#6b7280', fontSize: 11 }}>
                    {(p.site?.address ?? p.facility.address)?.replace(/東京都|埼玉県|神奈川県|宮城県|福岡県|大阪府/, '')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* スライドイン詳細パネル */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 360,
          height: '100%',
          background: '#fff',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.12)',
          transform: selected ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          overflowY: 'auto',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {selected && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{selected.facility.name}</div>
                  {selected.site?.site_name && (
                    <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500, marginTop: 2 }}>
                      🏭 {selected.site.site_name}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af', lineHeight: 1, padding: 0, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151', lineHeight: 1.9 }}>
                <div>📍 {selected.site?.address ?? selected.facility.address}</div>
                {selected.site?.site_type && <div>🔧 {selected.site.site_type}</div>}
                <div>🔢 {selected.facility.license_no}</div>
                <div>📋 {selected.facility.license_type}</div>
                <div>📅 許可期限：{selected.facility.expire_date}</div>
                <div>👤 {selected.facility.rep}</div>
              </div>

              <div style={{ padding: '10px 16px', flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>受入品目・処理能力</div>
                {detailLoading ? (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>読み込み中...</div>
                ) : !selected.site ? (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>施設情報なし（本社座標）</div>
                ) : detailCapacities.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>データなし</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        <th style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>品目</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>処理方法</th>
                        <th style={{ padding: '5px 8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>能力</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailCapacities.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '5px 8px', color: '#374151' }}>{c.waste_type}</td>
                          <td style={{ padding: '5px 8px', color: '#6b7280' }}>{c.process_type ?? '—'}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: '#374151', whiteSpace: 'nowrap' }}>
                            {c.capacity_value != null ? `${c.capacity_value} ${c.capacity_unit ?? ''}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
