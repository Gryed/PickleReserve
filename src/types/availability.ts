export interface OperatingHours {
  id: number
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

export interface Reservation {
  id: string
  court_id: string
  user_id: string
  date: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled'
  payment_type: 'full' | 'deposit'
  amount_due: number | null
  payment_status: 'pending' | 'verified' | 'rejected'
  payment_proof_url: string | null
  created_at: string
}

export interface TimeSlot {
  start_time: string
  end_time: string
  available: boolean
}