export interface Court {
  id: string
  name: string
  type: string | null
  price_per_hour: number
  status: 'available' | 'maintenance'
  created_at: string
}

export interface Settings {
  id: number
  show_court_type: boolean
  payment_mode: 'manual' | 'api'
  gcash_qr_url: string | null
  gcash_number: string | null
  deposit_percentage: number
}