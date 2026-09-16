import { supabase } from '../lib/supabase'
import type {
  Reservation,
  TimeSlot,
  OperatingHours,
} from '../types/availability'

/* =========================================================
   OPERATING HOURS
========================================================= */

export async function getOperatingHours(): Promise<OperatingHours[]> {
  const { data, error } = await supabase
    .from('operating_hours')
    .select('*')
    .order('day_of_week', { ascending: true })

  if (error) {
    console.error('Error fetching operating hours:', error)
    throw error
  }

  return data ?? []
}

export async function updateOperatingHours(
  dayOfWeek: number,
  updates: Partial<OperatingHours>
): Promise<OperatingHours> {
  const { data, error } = await supabase
    .from('operating_hours')
    .update(updates)
    .eq('day_of_week', dayOfWeek)
    .select()
    .single()

  if (error) {
    console.error('Error updating operating hours:', error)
    throw error
  }

  return data
}

/* =========================================================
   RESERVATIONS
========================================================= */

/**
 * Public reservation slot data.
 *
 * IMPORTANT:
 * This does NOT expose sensitive reservation fields.
 * Public availability is retrieved through the secure RPC.
 */
interface PublicReservationSlot {
  court_id: string
  booking_date: string
  start_time: string
  end_time: string
  payment_status: 'pending' | 'verified'
}

export async function getReservationsForCourtAndDate(
  courtId: string,
  date: string
): Promise<PublicReservationSlot[]> {
  const { data, error } = await supabase.rpc(
    'get_public_court_availability',
    {
      p_court_id: courtId,
      p_date: date,
    }
  )

  if (error) {
    console.error(
      'Error fetching public court availability:',
      error
    )
    throw error
  }

  return data ?? []
}

/* =========================================================
   CREATE RESERVATION
========================================================= */

export async function createReservation(
  reservation: Omit<Reservation, 'id' | 'created_at'>
): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .insert(reservation)
    .select()
    .single()

  if (error) {
    console.error('Error creating reservation:', error)
    throw error
  }

  return data
}

/* =========================================================
   CANCEL SINGLE RESERVATION
========================================================= */

/**
 * Customer / guest cancellation.
 *
 * Registered customer:
 * - authorization is handled by cancel_customer_reservation()
 * - auth.uid() must match reservation.user_id
 *
 * Guest:
 * - guest phone must match reservation.guest_phone
 *
 * Cancellation rules are enforced inside the RPC.
 */
export async function cancelReservation(
  reservationId: string,
  guestPhone?: string
): Promise<void> {
  const { error } = await supabase.rpc(
    'cancel_customer_reservation',
    {
      p_reservation_id: reservationId,
      p_guest_phone: guestPhone ?? null,
    }
  )

  if (error) {
    console.error(
      'Error cancelling reservation:',
      error
    )
    throw error
  }
}

/* =========================================================
   CANCEL ENTIRE BOOKING
========================================================= */

export async function cancelBooking(
  bookingReference: string | null,
  reservationId?: string
): Promise<void> {
  let query = supabase
    .from('reservations')
    .update({
      status: 'cancelled',
    })

  if (bookingReference) {
    query = query.eq(
      'booking_reference',
      bookingReference
    )
  } else if (reservationId) {
    query = query.eq('id', reservationId)
  } else {
    throw new Error(
      'Booking reference or reservation ID is required.'
    )
  }

  const { error } = await query

  if (error) {
    console.error('Error cancelling booking:', error)
    throw error
  }
}

/* =========================================================
   UPDATE PAYMENT STATUS FOR ENTIRE BOOKING
========================================================= */

export async function updateBookingPaymentStatus(
  bookingReference: string | null,
  paymentStatus: 'verified' | 'rejected',
  reservationId?: string
): Promise<void> {
  let query = supabase
    .from('reservations')
    .update({
      payment_status: paymentStatus,
    })

  if (bookingReference) {
    query = query.eq(
      'booking_reference',
      bookingReference
    )
  } else if (reservationId) {
    query = query.eq('id', reservationId)
  } else {
    throw new Error(
      'Booking reference or reservation ID is required.'
    )
  }

  const { error } = await query

  if (error) {
    console.error(
      'Error updating payment status:',
      error
    )
    throw error
  }
}

/* =========================================================
   VERIFY BOOKING PAYMENT
========================================================= */

export async function verifyBookingPayment(
  bookingReference: string | null
): Promise<void> {
  const reference = bookingReference?.trim()

  if (!reference) {
    throw new Error(
      'Booking reference is required for payment verification.'
    )
  }

  const { error } = await supabase.rpc(
    'verify_booking_payment',
    {
      p_booking_reference: reference,
    }
  )

  if (error) {
    console.error(
      'Error verifying booking payment:',
      error
    )
    throw error
  }
}

/* =========================================================
   REJECT BOOKING PAYMENT
========================================================= */

export async function rejectBookingPayment(
  bookingReference: string | null
): Promise<void> {
  const reference = bookingReference?.trim()

  if (!reference) {
    throw new Error(
      'Booking reference is required for payment rejection.'
    )
  }

  const { error } = await supabase.rpc(
    'reject_booking_payment',
    {
      p_booking_reference: reference,
    }
  )

  if (error) {
    console.error(
      'Error rejecting booking payment:',
      error
    )
    throw error
  }
}

/* =========================================================
   PENDING PAYMENTS
========================================================= */

export async function getPendingPaymentsAdmin(): Promise<
  Reservation[]
> {
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      courts (
        name
      )
    `)
    .eq('status', 'confirmed')
    .eq('payment_status', 'pending')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error(
      'Error fetching pending payments:',
      error
    )
    throw error
  }

  return data ?? []
}

/* =========================================================
   USER RESERVATIONS
========================================================= */

export async function getUserReservations(
  userId: string
): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      courts (
        name
      )
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })

  if (error) {
    console.error(
      'Error fetching user reservations:',
      error
    )
    throw error
  }

  return data ?? []
}

/* =========================================================
   ADMIN RESERVATIONS
========================================================= */

export async function getAllReservationsAdmin(): Promise<
  Reservation[]
> {
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      courts (
        name
      )
    `)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })

  if (error) {
    console.error(
      'Error fetching admin reservations:',
      error
    )
    throw error
  }

  return data ?? []
}

/* =========================================================
   ADMIN RESCHEDULED BOOKING REFERENCES
========================================================= */

export async function getAdminRescheduledBookingReferences(): Promise<
  string[]
> {
  const { data, error } = await supabase.rpc(
    'get_admin_rescheduled_booking_references'
  )

  if (error) {
    console.error(
      'Error fetching rescheduled booking references:',
      error
    )

    throw error
  }

  return Array.isArray(data)
    ? data
        .map((item) => item?.booking_reference)
        .filter(
          (value): value is string =>
            Boolean(value)
        )
    : []
}

/* =========================================================
   CANCELLATION RULE
========================================================= */

export function canCancel(
  reservation: Reservation
): boolean {
  if (reservation.status !== 'confirmed') {
    return false
  }

  const bookingDateTime = new Date(
    `${reservation.date}T${reservation.start_time}:00`
  )

  const now = new Date()

  const differenceInHours =
    (bookingDateTime.getTime() -
      now.getTime()) /
    (1000 * 60 * 60)

  return differenceInHours >= 24
}

/* =========================================================
   TIME HELPERS
========================================================= */

function timeToMinutes(
  time: string
): number {
  const [hours, minutes] =
    time.split(':').map(Number)

  return hours * 60 + minutes
}

function minutesToTime(
  totalMinutes: number
): string {
  const normalizedMinutes =
    totalMinutes % (24 * 60)

  const hours =
    Math.floor(normalizedMinutes / 60)

  const minutes =
    normalizedMinutes % 60

  return `${hours
    .toString()
    .padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`
}

/* =========================================================
   TIME SLOT GENERATOR
========================================================= */

function generateTimeSlots(
  openTime: string,
  closeTime: string,
  existingReservations: PublicReservationSlot[]
): TimeSlot[] {
  let openMinutes =
    timeToMinutes(openTime)

  let closeMinutes =
    timeToMinutes(closeTime)

  if (
    closeMinutes <= openMinutes &&
    closeMinutes !== 1440
  ) {
    closeMinutes += 1440
  }

  const slots: TimeSlot[] = []

  for (
    let current = openMinutes;
    current < closeMinutes;
    current += 60
  ) {
    const next = Math.min(
      current + 60,
      closeMinutes
    )

    const startTime =
      minutesToTime(current)

    const endTime =
      minutesToTime(next)

    const reservation =
      existingReservations.find(
        (item) =>
          timeToMinutes(item.start_time) ===
          current % (24 * 60)
      )

    const isPending =
      reservation?.payment_status ===
      'pending'

    const isBooked =
      reservation?.payment_status ===
      'verified'

    slots.push({
      start_time: startTime,
      end_time: endTime,

      available: !reservation,

      status: reservation
        ? isPending
          ? 'pending'
          : isBooked
            ? 'booked'
            : 'available'
        : 'available',

      bookedByName: undefined,
    })
  }

  return slots
}

/* =========================================================
   AVAILABLE SLOTS
========================================================= */

export async function getAvailableSlots(
  courtId: string,
  date: string
): Promise<TimeSlot[]> {
  const selectedDate =
    new Date(`${date}T00:00:00`)

  if (
    Number.isNaN(
      selectedDate.getTime()
    )
  ) {
    throw new Error(
      'Invalid booking date.'
    )
  }

  const dayOfWeek =
    selectedDate.getDay()

  const {
    data: court,
    error: courtError,
  } = await supabase
    .from('courts')
    .select(
      'id, name, is_24_hours'
    )
    .eq('id', courtId)
    .single()

  if (courtError) {
    console.error(
      'Error fetching court:',
      courtError
    )
    throw courtError
  }

  const existingReservations =
    await getReservationsForCourtAndDate(
      courtId,
      date
    )

  /* =======================================================
     24-HOUR COURT
  ======================================================= */

  if (court.is_24_hours) {
    return generateTimeSlots(
      '00:00',
      '24:00',
      existingReservations
    )
  }

  /* =======================================================
     NORMAL OPERATING HOURS
  ======================================================= */

  const {
    data: operatingHour,
    error: operatingHourError,
  } = await supabase
    .from('operating_hours')
    .select('*')
    .eq('day_of_week', dayOfWeek)
    .single()

  if (operatingHourError) {
    console.error(
      'Error fetching operating hours:',
      operatingHourError
    )
    throw operatingHourError
  }

  if (
    !operatingHour ||
    operatingHour.is_closed
  ) {
    return []
  }

  return generateTimeSlots(
    operatingHour.open_time,
    operatingHour.close_time,
    existingReservations
  )
}

/* =========================================================
   PUBLIC BOOKING LOOKUP
========================================================= */

interface PublicBookingLookupRow {
  id: string
  court_id: string
  date: string
  start_time: string
  end_time: string
  status: string
  payment_type: string
  amount_due: number | null
  payment_status: string
  guest_name: string | null
  guest_phone: string | null
  booking_reference: string | null
  court_name: string | null
}

function mapPublicBookingLookup(
  row: PublicBookingLookupRow
): Reservation {
  return {
    id: row.id,
    court_id: row.court_id,
    user_id: null,
    date: row.date,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.status as Reservation['status'],
    payment_type:
      row.payment_type as Reservation['payment_type'],
    amount_due: row.amount_due,
    payment_status:
      row.payment_status as Reservation['payment_status'],
    payment_proof_url: null,
    guest_name: row.guest_name,
    guest_phone: row.guest_phone,
    booking_reference: row.booking_reference,
    created_at: '',
    
  }
}

/* =========================================================
   GUEST RESERVATIONS
========================================================= */

export async function getGuestReservationsByPhone(
  phone: string
): Promise<Reservation[]> {
  const { data, error } =
    await supabase.rpc(
      'get_public_booking_by_phone',
      {
        p_guest_phone: phone,
      }
    )

  if (error) {
    console.error(
      'Error fetching guest reservations:',
      error
    )
    throw error
  }

  return (
    (data ?? []) as PublicBookingLookupRow[]
  ).map(mapPublicBookingLookup)
}

/* =========================================================
   BOOKING REFERENCE SEARCH
========================================================= */

export async function getReservationsByReference(
  reference: string
): Promise<Reservation[]> {
  const { data, error } =
    await supabase.rpc(
      'get_public_booking_by_reference',
      {
        p_booking_reference: reference,
      }
    )

  if (error) {
    console.error(
      'Error fetching reservations by reference:',
      error
    )
    throw error
  }

  return (
    (data ?? []) as PublicBookingLookupRow[]
  ).map(mapPublicBookingLookup)
}

/* =========================================================
   GENERATE BOOKING REFERENCE
========================================================= */

export async function generateBookingReference(): Promise<string> {
  const { data, error } =
    await supabase.rpc(
      'generate_booking_reference'
    )

  if (error) {
    console.error(
      'Error generating booking reference:',
      error
    )
    throw error
  }

  return data
}

/* =========================================================
   ADMIN DIRECT RESCHEDULE
========================================================= */

export interface AdminRescheduleSlot {
  court_id: string
  date: string
  start_time: string
  end_time: string
}

export async function adminRescheduleBooking(
  bookingReference: string,
  newSlots: AdminRescheduleSlot[]
): Promise<void> {
  const reference =
    bookingReference?.trim()

  if (!reference) {
    throw new Error(
      'Booking reference is required.'
    )
  }

  if (!newSlots.length) {
    throw new Error(
      'At least one new time slot is required.'
    )
  }

  const { error } =
    await supabase.rpc(
      'admin_reschedule_booking',
      {
        p_booking_reference: reference,
        p_new_slots: newSlots,
      }
    )

  if (error) {
    console.error(
      'RESCHEDULE RPC ERROR'
    )

    console.error(
      'message:',
      error.message
    )

    console.error(
      'details:',
      error.details
    )

    console.error(
      'hint:',
      error.hint
    )

    console.error(
      'code:',
      error.code
    )

    console.error(
      'full error:',
      error
    )

    throw error
  }
}