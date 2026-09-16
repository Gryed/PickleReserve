export type OpenPlaySessionStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'cancelled'
  | 'completed'

export type OpenPlayParticipantStatus =
  | 'held'
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'expired'

export type OpenPlayPaymentStatus =
  | 'pending'
  | 'verified'
  | 'rejected'

export type OpenPlayPaymentMethod =
  | 'gcash'
  | 'bank_transfer'
  | 'other'

export interface OpenPlaySession {
  id: string
  session_reference: string
  title: string
  court_id: string
  session_date: string
  start_time: string
  end_time: string
  price_per_player: number
  capacity: number
  status: OpenPlaySessionStatus
  description: string | null
  rules: string | null
  registration_opens_at: string | null
  registration_closes_at: string | null
  created_by: string
  cancelled_at: string | null
  cancelled_by: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface OpenPlaySessionPublic {
  id: string
  session_reference: string
  title: string
  court_id: string
  court_name: string
  session_date: string
  start_time: string
  end_time: string
  price_per_player: number
  capacity: number
  status: OpenPlaySessionStatus
  description: string | null
  rules: string | null
  registration_opens_at: string | null
  registration_closes_at: string | null
  created_at: string
  updated_at: string
}

export interface OpenPlayParticipant {
  id: string
  session_id: string
  user_id: string
  participant_name: string
  contact_phone: string | null
  status: OpenPlayParticipantStatus
  amount_due: number
  hold_expires_at: string | null
  rejection_reason: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface OpenPlayPayment {
  id: string
  booking_reference: string | null
  payment_method: OpenPlayPaymentMethod
  amount: number
  transaction_reference: string | null
  payment_date: string | null
  payment_time: string | null
  sender_name: string | null
  sender_account: string | null
  recipient_name: string | null
  proof_url: string | null
  status: OpenPlayPaymentStatus
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
  open_play_participant_id: string | null
}

export interface CreateOpenPlaySessionInput {
  session_reference: string
  title: string
  court_id: string
  session_date: string
  start_time: string
  end_time: string
  price_per_player: number
  capacity: number
  description?: string | null
  rules?: string | null
  registration_opens_at?: string | null
  registration_closes_at?: string | null
}

export interface UpdateOpenPlaySessionInput {
  id: string
  title: string
  court_id: string
  session_date: string
  start_time: string
  end_time: string
  price_per_player: number
  capacity: number
  description?: string | null
  rules?: string | null
  registration_opens_at?: string | null
  registration_closes_at?: string | null
}

export interface JoinOpenPlayInput {
  session_id: string
  participant_name: string
  contact_phone?: string | null
}

export interface SubmitOpenPlayPaymentInput {
  participant_id: string
  payment_method: OpenPlayPaymentMethod
  amount: number
  transaction_reference: string
  payment_date: string
  payment_time: string
  sender_name: string
  sender_account: string
  recipient_name: string
  proof_url: string
  payment_provider?: string | null
  provider_transaction_id?: string | null
}

export interface CancelOpenPlayParticipationInput {
  participant_id: string
  cancellation_reason?: string | null
}