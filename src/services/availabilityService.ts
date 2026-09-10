import { supabase } from '../lib/supabase'
import type {
  OperatingHours,
  Reservation,
  TimeSlot,
} from '../types/availability'

/* =========================================================
   OPERATING HOURS
========================================================= */

export async function getOperatingHours(): Promise<
  OperatingHours[]
> {
  const { data, error } = await supabase
    .from('operating_hours')
    .select('*')
    .order('day_of_week', {
      ascending: true,
    })

  if (error) throw error

  return data as OperatingHours[]
}

export async function updateOperatingHours(
  dayOfWeek: number,
  updates: Partial<
    Pick<
      OperatingHours,
      'open_time' | 'close_time' | 'is_closed'
    >
  >
): Promise<OperatingHours> {
  const { data, error } = await supabase
    .from('operating_hours')
    .update(updates)
    .eq('day_of_week', dayOfWeek)
    .select()
    .single()

  if (error) throw error

  return data as OperatingHours
}

/* =========================================================
   RESERVATIONS
========================================================= */

export async function getReservationsForCourtAndDate(
  courtId: string,
  date: string
): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('court_id', courtId)
    .eq('date', date)
    .eq('status', 'confirmed')

  if (error) throw error

  return data as Reservation[]
}

export async function createReservation(
  reservation: {
    court_id: string
    user_id: string | null
    guest_name?: string | null
    guest_phone?: string | null
    date: string
    start_time: string
    end_time: string
    payment_type: 'full' | 'deposit'
    amount_due: number
    payment_proof_url: string
    booking_reference: string
  }
): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      ...reservation,
      status: 'confirmed',
      payment_status: 'pending',
    })
    .select()
    .single()

  if (error) throw error

  return data as Reservation
}

export async function cancelReservation(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
    })
    .eq('id', id)

  if (error) throw error
}

export async function getUserReservations(
  userId: string
): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, courts(name)')
    .eq('user_id', userId)
    .order('date', {
      ascending: false,
    })
    .order('start_time', {
      ascending: true,
    })

  if (error) throw error

  return data as unknown as Reservation[]
}

export async function getAllReservationsAdmin() {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, courts(name)')
    .order('date', {
      ascending: false,
    })
    .order('start_time', {
      ascending: true,
    })

  if (error) throw error

  return data
}

/* =========================================================
   CANCELLATION
========================================================= */

export function canCancel(
  reservation: Reservation
): boolean {
  const bookingDateTime = new Date(
    `${reservation.date}T${reservation.start_time}`
  )

  const now = new Date()

  const hoursUntilBooking =
    (bookingDateTime.getTime() -
      now.getTime()) /
    (1000 * 60 * 60)

  return (
    reservation.status === 'confirmed' &&
    hoursUntilBooking >= 24
  )
}

/* =========================================================
   TIME HELPERS
========================================================= */

/**
 * Converts a database time string such as:
 *
 * 06:00:00
 * 12:00:00
 * 18:30:00
 * 24:00:00
 *
 * into minutes from midnight.
 */
function timeToMinutes(
  time: string
): number {
  const [
    hours,
    minutes = 0,
  ] = time
    .split(':')
    .map(Number)

  return (
    hours * 60 +
    minutes
  )
}

/**
 * Formats minutes from midnight.
 *
 * 360  -> 06:00:00
 * 720  -> 12:00:00
 * 1380 -> 23:00:00
 * 1440 -> 24:00:00
 */
function minutesToTime(
  totalMinutes: number
): string {
  const hours =
    Math.floor(
      totalMinutes / 60
    )

  const minutes =
    totalMinutes % 60

  return `${String(
    hours
  ).padStart(2, '0')}:${String(
    minutes
  ).padStart(2, '0')}:00`
}

/* =========================================================
   GENERATE TIME SLOTS
========================================================= */

/**
 * Generates 1-hour booking slots.
 *
 * Normal example:
 *
 * 06:00 -> 00:00
 *
 * produces:
 *
 * 06:00 - 07:00
 * 07:00 - 08:00
 * ...
 * 22:00 - 23:00
 * 23:00 - 24:00
 *
 * 24-hour example:
 *
 * 00:00 -> 24:00
 *
 * produces exactly 24 slots:
 *
 * 00:00 - 01:00
 * 01:00 - 02:00
 * ...
 * 22:00 - 23:00
 * 23:00 - 24:00
 */
export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  existingReservations: Reservation[]
): TimeSlot[] {
  const slots: TimeSlot[] = []

  const openMinutes =
    timeToMinutes(openTime)

  let closeMinutes =
    timeToMinutes(closeTime)

  /*
   * Midnight / overnight handling.
   *
   * Example:
   *
   * open = 06:00 -> 360
   * close = 00:00 -> 0
   *
   * Since close is earlier than open,
   * the closing time belongs to the next day.
   *
   * IMPORTANT:
   *
   * 00:00 -> 24:00 is already a full-day range,
   * so closeMinutes must remain 1440.
   */
  if (
    closeMinutes <= openMinutes &&
    closeMinutes !== 24 * 60
  ) {
    closeMinutes += 24 * 60
  }

  /*
   * Generate exactly one-hour slots.
   */
  for (
    let startMinutes = openMinutes;
    startMinutes < closeMinutes;
    startMinutes += 60
  ) {
    const endMinutes =
      startMinutes + 60

    /*
     * Don't create a partial slot.
     *
     * Example:
     *
     * 06:00 -> 23:30
     *
     * stops at:
     *
     * 22:00 -> 23:00
     *
     * because 23:00 -> 00:00 would exceed
     * the configured closing time.
     */
    if (
      endMinutes >
      closeMinutes
    ) {
      break
    }

    /*
     * Keep 24:00 internally for the final
     * midnight slot.
     */
    const start =
      minutesToTime(
        startMinutes
      )

    const end =
      minutesToTime(
        endMinutes
      )

    const match =
      existingReservations.find(
        (reservation) =>
          reservation.start_time ===
          start
      )

    const bookedByName =
      match
        ? match.guest_name ??
          'Member'
        : undefined

    slots.push({
      start_time: start,
      end_time: end,
      available: !match,
      bookedByName,
    })
  }

  return slots
}

/* =========================================================
   GET AVAILABLE SLOTS
========================================================= */

export async function getAvailableSlots(
  courtId: string,
  date: string
): Promise<TimeSlot[]> {
  if (
    !courtId ||
    !date
  ) {
    return []
  }

  /*
   * Parse YYYY-MM-DD manually.
   *
   * This prevents timezone issues that can happen
   * when using:
   *
   * new Date('YYYY-MM-DD')
   */
  const [
    year,
    month,
    day,
  ] = date
    .split('-')
    .map(Number)

  const localDate =
    new Date(
      year,
      month - 1,
      day
    )

  /*
   * JavaScript:
   *
   * Sunday    = 0
   * Monday    = 1
   * Tuesday   = 2
   * Wednesday = 3
   * Thursday  = 4
   * Friday    = 5
   * Saturday  = 6
   */
  const dayOfWeek =
    localDate.getDay()

  /* =======================================================
     GET COURT SETTINGS
  ======================================================= */

  /*
   * We only need is_24_hours here.
   *
   * Existing courts default to false, so their
   * current Operating Hours behavior remains unchanged.
   */
  const {
    data: court,
    error: courtError,
  } = await supabase
    .from('courts')
    .select('id, name, is_24_hours')
    .eq('id', courtId)
    .single()

  if (courtError) {
    throw courtError
  }

  /*
   * Get reservations first.
   *
   * Both normal courts and 24-hour courts need
   * the same reservation blocking logic.
   */
  const reservations =
    await getReservationsForCourtAndDate(
      courtId,
      date
    )

  /* =======================================================
     24 HOURS OPERATIONS
  ======================================================= */

  /*
   * IMPORTANT:
   *
   * If this court is configured as 24 hours,
   * completely bypass the normal Operating Hours
   * table.
   *
   * This means:
   *
   * is_24_hours = true
   *       ↓
   * 00:00 - 24:00
   *       ↓
   * 24 one-hour slots
   *
   * Weekend availability is NOT changed for courts
   * where is_24_hours is false.
   */
  if (court?.is_24_hours === true) {
    console.log(
      '[PickleReserve] 24-hour court availability:',
      {
        date,
        dayOfWeek,
        courtId,
        courtName: court.name,
        is24Hours: true,
        totalSlots: 24,
      }
    )

    return generateTimeSlots(
      '00:00:00',
      '24:00:00',
      reservations
    )
  }

  /* =======================================================
     NORMAL OPERATING HOURS
  ======================================================= */

  /*
   * If 24 Hours Operations is OFF,
   * use the existing Operating Hours configuration.
   *
   * This preserves the current schedule exactly.
   *
   * Example:
   *
   * Saturday -> 18 slots
   * Sunday   -> 6 slots
   *
   * Nothing here changes those values.
   */
  const hours =
    await getOperatingHours()

  console.log(
    '[PickleReserve] Availability check:',
    {
      date,
      dayOfWeek,
      courtId,
      is24Hours: false,
      operatingHours: hours,
    }
  )

  const dayHours =
    hours.find(
      (item) =>
        Number(
          item.day_of_week
        ) === dayOfWeek
    )

  /*
   * No operating-hours row.
   */
  if (!dayHours) {
    console.warn(
      '[PickleReserve] No operating hours found:',
      {
        date,
        dayOfWeek,
        hours,
      }
    )

    return []
  }

  /*
   * Explicitly closed.
   */
  if (
    dayHours.is_closed
  ) {
    console.log(
      '[PickleReserve] Court closed on this date:',
      {
        date,
        dayOfWeek,
      }
    )

    return []
  }

  /*
   * Make sure the configured times actually exist.
   */
  if (
    !dayHours.open_time ||
    !dayHours.close_time
  ) {
    console.warn(
      '[PickleReserve] Invalid operating hours:',
      dayHours
    )

    return []
  }

  /*
   * Use the existing schedule exactly as configured.
   */
  return generateTimeSlots(
    dayHours.open_time,
    dayHours.close_time,
    reservations
  )
}

/* =========================================================
   GUEST BOOKINGS
========================================================= */

export async function getGuestReservationsByPhone(
  phone: string
): Promise<Reservation[]> {
  const { data, error } =
    await supabase
      .from('reservations')
      .select(
        '*, courts(name)'
      )
      .eq(
        'guest_phone',
        phone.trim()
      )
      .order('date', {
        ascending: false,
      })
      .order('start_time', {
        ascending: true,
      })

  if (error) throw error

  return data as unknown as Reservation[]
}

/* =========================================================
   BOOKING REFERENCE
========================================================= */

export async function generateBookingReference(): Promise<string> {
  const { data, error } =
    await supabase.rpc(
      'generate_booking_reference'
    )

  if (error) throw error

  return data as string
}

export async function getReservationsByReference(
  reference: string
): Promise<Reservation[]> {
  const { data, error } =
    await supabase
      .from('reservations')
      .select(
        '*, courts(name)'
      )
      .eq(
        'booking_reference',
        reference
          .trim()
          .toUpperCase()
      )
      .order('date', {
        ascending: false,
      })
      .order('start_time', {
        ascending: true,
      })

  if (error) throw error

  return data as unknown as Reservation[]
}