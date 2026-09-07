import { supabase } from '../lib/supabase'
import type { OperatingHours, Reservation, TimeSlot } from '../types/availability'

export async function getOperatingHours(): Promise<OperatingHours[]> {
  const { data, error } = await supabase
    .from('operating_hours')
    .select('*')
    .order('day_of_week', { ascending: true })

  if (error) throw error
  return data as OperatingHours[]
}

export async function updateOperatingHours(
  dayOfWeek: number,
  updates: Partial<Pick<OperatingHours, 'open_time' | 'close_time' | 'is_closed'>>
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

export async function createReservation(reservation: {
  court_id: string
  user_id: string | null
  guest_name?: string | null
  guest_phone?: string | null
  date: string
  start_time: string
  end_time: string
}): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .insert({ ...reservation, status: 'confirmed' })
    .select()
    .single()

  if (error) throw error
  return data as Reservation
}

export async function cancelReservation(id: string): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) throw error
}

export async function getUserReservations(userId: string): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, courts(name)')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })

  if (error) throw error
  return data as unknown as Reservation[]
}

export function canCancel(reservation: Reservation): boolean {
  const bookingDateTime = new Date(`${reservation.date}T${reservation.start_time}`)
  const now = new Date()
  const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  return reservation.status === 'confirmed' && hoursUntilBooking >= 24
}

/**
 * Generates all possible 1-hour time slots for a given day, marking
 * which ones are already booked.
 */
export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  existingReservations: Reservation[]
): TimeSlot[] {
  const slots: TimeSlot[] = []

  const [openHour] = openTime.split(':').map(Number)
  const [closeHour] = closeTime.split(':').map(Number)

  for (let hour = openHour; hour < closeHour; hour++) {
    const start = `${String(hour).padStart(2, '0')}:00:00`
    const end = `${String(hour + 1).padStart(2, '0')}:00:00`

    const isBooked = existingReservations.some(
      (r) => r.start_time === start
    )

    slots.push({
      start_time: start,
      end_time: end,
      available: !isBooked,
    })
  }

  return slots
}

/**
 * Gets available time slots for a specific court on a specific date,
 * accounting for operating hours and existing reservations.
 */
export async function getAvailableSlots(
  courtId: string,
  date: string
): Promise<TimeSlot[]> {
  const dayOfWeek = new Date(date).getDay()

  const hours = await getOperatingHours()
  const dayHours = hours.find((h) => h.day_of_week === dayOfWeek)

  if (!dayHours || dayHours.is_closed) {
    return []
  }

  const reservations = await getReservationsForCourtAndDate(courtId, date)

  return generateTimeSlots(dayHours.open_time, dayHours.close_time, reservations)
}