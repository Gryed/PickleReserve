export interface OperatingHours {
  id: number
  day_of_week: number // 0 = Sunday, 6 = Saturday
  open_time: string // "06:00:00"
  close_time: string // "22:00:00"
  is_closed: boolean
}

export interface Reservation {
  id: string
  court_id: string
  user_id: string | null
  guest_name: string | null
  guest_phone: string | null
  date: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled'
  payment_type: 'full' | 'deposit'
  amount_due: number | null
  payment_status: 'pending' | 'verified' | 'rejected'
  payment_proof_url: string | null
  booking_reference: string | null
  created_at: string
}

export interface TimeSlot {
  start_time: string
  end_time: string
  available: boolean
  bookedByName?: string
}