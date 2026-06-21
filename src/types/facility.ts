export type Facility = {
  id: number
  name: string
  rep: string | null
  address: string | null
  lat: number | null
  lon: number | null
  license_no: string | null
  license_type: string | null
  license_date: string | null
  expire_date: string | null
  pref: string | null
}

export type FacilitySite = {
  id: number
  facility_id: number
  site_name: string | null
  address: string | null
  lat: number | null
  lon: number | null
  site_type: string | null
  facilities?: Facility
}
