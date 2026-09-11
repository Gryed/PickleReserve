import { supabase } from '../lib/supabase'
import type { Reservation } from '../types/availability'

export interface AtomicBookingSlot {
  court_id: string
  user_id: string | null
  guest_name: string | null
  guest_phone: string | null
  date: string
  start_time: string
  end_time: string
  payment_type: 'full' | 'deposit'
  amount_due: number
  payment_proof_url: string | null
  booking_reference: string
}

export async function createBookingAtomic(
  reservations: AtomicBookingSlot[]
): Promise<Reservation[]> {
  const { data, error } = await supabase.rpc(
    'create_booking_atomic',
    {
      p_reservations: reservations,
    }
  )

  if (error) {
    console.error(
      'Atomic booking failed:',
      error
    )

    throw new Error(
      error.message ||
        'One or more selected time slots are no longer available.'
    )
  }

  return (data ?? []) as Reservation[]
}