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
  status?: 'available' | 'selected' | 'pending' | 'booked'
}

export type PaymentMethod =
  | 'gcash'
  | 'bank_transfer'
  | 'other'

export type PaymentStatus =
  | 'pending'
  | 'verified'
  | 'rejected'

export interface Payment {
  id: string
  booking_reference: string
  payment_method: PaymentMethod
  amount: number
  transaction_reference: string | null
  payment_date: string | null
  payment_time: string | null
  sender_name: string | null
  sender_account: string | null
  recipient_name: string | null
  proof_url: string | null
  status: PaymentStatus

  // Future automatic payment API
  payment_provider: string | null
  provider_transaction_id: string | null
  provider_status: string | null

  submitted_at: string
  verified_at: string | null
  rejected_at: string | null
  rejection_reason: string | null

  verified_by: string | null
  rejected_by: string | null

  created_at: string
  updated_at: string
}