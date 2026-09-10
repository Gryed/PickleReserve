export interface Court {
  id: string
  name: string
  type: string | null

  price_per_hour: number

  weekend_pricing_enabled: boolean
  weekend_price_per_hour: number | null

  is_24_hours: boolean

  status:
    | 'available'
    | 'maintenance'
    | 'not_available'

  created_at: string
}

export interface Settings {
  id: number
  show_court_type: boolean
  payment_mode: 'manual' | 'api'
  gcash_qr_url: string | null
  gcash_number: string | null
  gcash_name: string | null
  deposit_percentage: number
  booking_horizon_days: number
}