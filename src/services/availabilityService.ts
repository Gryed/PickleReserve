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
 * Get confirmed reservations for a specific court/date.
 *
 * IMPORTANT:
 * Only confirmed reservations block the available slots.
 * Cancelled reservations are intentionally ignored.
 */
export async function getReservationsForCourtAndDate(
  courtId: string,
  date: string
): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('court_id', courtId)
    .eq('date', date)
    .in('status', ['confirmed'])
    .in('payment_status', ['pending', 'verified'])
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching reservations:', error)
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
   Kept for existing FindBooking compatibility.
========================================================= */

export async function cancelReservation(
  reservationId: string
): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
    })
    .eq('id', reservationId)
    .select()
    .single()

  if (error) {
    console.error('Error cancelling reservation:', error)
    throw error
  }

  return data
}

/* =========================================================
   CANCEL ENTIRE BOOKING
========================================================= */

/**
 * Cancels all reservation rows belonging to the same
 * booking reference.
 *
 * A multi-hour booking is stored as multiple reservation
 * rows, so cancelling by booking reference is important.
 *
 * If there is no booking reference, falls back to a
 * single reservation ID.
 */
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

/**
 * Updates payment status for all rows belonging to
 * one booking.
 *
 * Used primarily for:
 *   pending → verified
 */
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

/**
 * Gets bookings that still require payment verification.
 *
 * Only confirmed reservations with pending payment
 * are returned.
 */
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
   GET BOOKING BY REFERENCE
========================================================= */
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
        .map((item) => String(item))
        .filter(Boolean)
    : []
}
/**
 * Gets every reservation row belonging to one booking.
 *
 * Useful for Admin Reservations and Pending Payments
 * when displaying one multi-hour booking as a single
 * booking card.
 */
export async function getBookingByReference(
  bookingReference: string
): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      courts (
        name
      )
    `)
    .eq(
      'booking_reference',
      bookingReference
    )
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error(
      'Error fetching booking:',
      error
    )
    throw error
  }

  return data ?? []
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
  existingReservations: Reservation[]
): TimeSlot[] {
  let openMinutes = timeToMinutes(openTime)

  let closeMinutes = timeToMinutes(closeTime)

  /*
    Overnight schedule example:

    16:00 → 01:00

    becomes:

    16:00 → 25:00
  */
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

    const startTime = minutesToTime(current)

    const endTime = minutesToTime(next)

    const reservation =
      existingReservations.find(
        (item) =>
          timeToMinutes(item.start_time) ===
          current % (24 * 60)
      )

    const isPending =
      reservation?.payment_status === 'pending'

    const isBooked =
      reservation?.payment_status === 'verified'

    slots.push({
      start_time: startTime,
      end_time: endTime,

      // Both pending and verified bookings
      // must block the slot.
      available: !reservation,

      // Used by the UI later to distinguish
      // pending from booked.
      status: reservation
        ? isPending
          ? 'pending'
          : isBooked
            ? 'booked'
            : 'available'
        : 'available',

      bookedByName: reservation
        ? reservation.guest_name || 'Member'
        : undefined,
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
   GUEST RESERVATIONS
========================================================= */

export async function getGuestReservationsByPhone(
  phone: string
): Promise<Reservation[]> {
  const { data, error } =
    await supabase
      .from('reservations')
      .select(`
        *,
        courts (
          name
        )
      `)
      .eq('guest_phone', phone)
      .order('date', {
        ascending: false,
      })
      .order('start_time', {
        ascending: true,
      })

  if (error) {
    console.error(
      'Error fetching guest reservations:',
      error
    )
    throw error
  }

  return data ?? []
}

/* =========================================================
   BOOKING REFERENCE SEARCH
========================================================= */

export async function getReservationsByReference(
  reference: string
): Promise<Reservation[]> {
  const { data, error } =
    await supabase
      .from('reservations')
      .select(`
        *,
        courts (
          name
        )
      `)
      .eq(
        'booking_reference',
        reference
      )
      .order('date', {
        ascending: false,
      })
      .order('start_time', {
        ascending: true,
      })

  if (error) {
    console.error(
      'Error fetching reservations by reference:',
      error
    )
    throw error
  }

  return data ?? []
}


/* =========================================================
   RESCHEDULE REQUEST
========================================================= */

export interface RescheduleSlot {
  court_id: string
  date: string
  start_time: string
  end_time: string
}

/**
 * Creates a multi-slot reschedule request.
 *
 * The booking remains unchanged until an admin approves
 * the request.
 *
 * The number of requested slots must match the number
 * of reservation rows in the existing booking.
 */
export async function createRescheduleRequest(
  bookingReference: string,
  newSlots: RescheduleSlot[]
): Promise<string> {
  const reference = bookingReference?.trim()

  if (!reference) {
    throw new Error(
      'Booking reference is required for reschedule.'
    )
  }

  if (!newSlots.length) {
    throw new Error(
      'At least one new time slot is required.'
    )
  }

  const { data, error } = await supabase.rpc(
    'create_reschedule_request_multislot',
    {
      p_booking_reference: reference,
      p_new_slots: newSlots,
    }
  )

  if (error) {
    console.error(
      'Error creating reschedule request:',
      error
    )
    throw error
  }

  if (!data) {
    throw new Error(
      'Unable to create reschedule request.'
    )
  }

  return data as string
}

/* =========================================================
   GET CUSTOMER RESCHEDULE REQUESTS
========================================================= */

export interface RescheduleRequest {
  id: string
  booking_reference: string

  old_date: string
  old_court_id: string
  old_start_time: string
  old_end_time: string

  new_date: string
  new_court_id: string
  new_start_time: string
  new_end_time: string

  new_slots: RescheduleSlot[] | null

  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled'

  requested_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null

  created_at: string
  updated_at: string
}

/**
 * Gets reschedule requests for the currently
 * authenticated customer.
 */
export async function getMyRescheduleRequests(): Promise<
  RescheduleRequest[]
> {
  const { data, error } = await supabase
    .from('booking_reschedule_requests')
    .select('*')
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    console.error(
      'Error fetching reschedule requests:',
      error
    )
    throw error
  }

  return (data ?? []) as RescheduleRequest[]
}

/* =========================================================
   GET RESCHEDULE REQUEST BY BOOKING
========================================================= */

export async function getRescheduleRequestByBooking(
  bookingReference: string
): Promise<RescheduleRequest | null> {
  const reference = bookingReference?.trim()

  if (!reference) {
    return null
  }

  const { data, error } = await supabase
    .from('booking_reschedule_requests')
    .select('*')
    .eq(
      'booking_reference',
      reference
    )
    .order('created_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      'Error fetching reschedule request:',
      error
    )
    throw error
  }

  return data as RescheduleRequest | null
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
  const reference = bookingReference?.trim()

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

  const { error } = await supabase.rpc(
    'admin_reschedule_booking',
    {
      p_booking_reference: reference,
      p_new_slots: newSlots,
    }
  )

  if (error) {
    console.error(
      'Error rescheduling booking:',
      error
    )

    throw error
  }
}