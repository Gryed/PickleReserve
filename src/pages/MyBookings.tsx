import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Reservation, TimeSlot } from '../types/availability'
import type { Court } from '../types/court'

import {
  getUserReservations,
  cancelReservation,
  canCancel,
  getRescheduleRequestByBooking,
  createCustomerRescheduleRequest,
  getAvailableSlots,
} from '../services/availabilityService'

import type { RescheduleRequest } from '../services/availabilityService'
import { getCourts } from '../services/courtService'
import { useAuth } from '../context/AuthContext'

interface BookingWithCourt extends Reservation {
  courts: { name: string } | null
}

interface BookingRescheduleState {
  request: RescheduleRequest | null
  loading: boolean
}

export default function MyBookings() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [bookings, setBookings] = useState<BookingWithCourt[]>([])
  const [rescheduleStates, setRescheduleStates] = useState<
    Record<string, BookingRescheduleState>
  >({})

  const [courts, setCourts] = useState<Court[]>([])
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false)

  const [error, setError] = useState('')
  const [rescheduleError, setRescheduleError] = useState('')

  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [submittingReschedule, setSubmittingReschedule] = useState(false)

  const [newDate, setNewDate] = useState('')
  const [newCourtId, setNewCourtId] = useState('')
  const [newTime, setNewTime] = useState<TimeSlot | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      navigate('/login')
      return
    }

    loadBookings()
  }, [user, authLoading])

  async function loadBookings() {
    if (!user) return

    try {
      setLoading(true)
      setError('')

      const [bookingData, courtData] = await Promise.all([
        getUserReservations(user.id),
        getCourts(),
      ])

      const userBookings = bookingData as BookingWithCourt[]

      setBookings(userBookings)
      setCourts(courtData)

      const rescheduleResults: Record<
        string,
        BookingRescheduleState
      > = {}

      await Promise.all(
        userBookings
          .filter(
            (booking) =>
              booking.status === 'confirmed' &&
              booking.payment_status === 'verified' &&
              Boolean(booking.booking_reference)
          )
          .map(async (booking) => {
            try {
              const request = await getRescheduleRequestByBooking(
                booking.booking_reference!
              )

              rescheduleResults[booking.id] = {
                request,
                loading: false,
              }
            } catch {
              rescheduleResults[booking.id] = {
                request: null,
                loading: false,
              }
            }
          })
      )

      setRescheduleStates(rescheduleResults)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load bookings'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this booking?')) return

    setCancellingId(id)
    setError('')

    try {
      await cancelReservation(id)
      await loadBookings()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to cancel'
      )
    } finally {
      setCancellingId(null)
    }
  }

  function getOriginalStart(booking: BookingWithCourt) {
    return new Date(
      `${booking.date}T${booking.start_time.slice(0, 5)}:00`
    )
  }

  function has24HourNotice(booking: BookingWithCourt) {
    const originalStart = getOriginalStart(booking)
    const now = new Date()

    const differenceInHours =
      (originalStart.getTime() - now.getTime()) /
      (1000 * 60 * 60)

    return differenceInHours >= 24
  }

  function getRescheduleState(
    booking: BookingWithCourt
  ): BookingRescheduleState {
    return (
      rescheduleStates[booking.id] ?? {
        request: null,
        loading: false,
      }
    )
  }

  function canReschedule(booking: BookingWithCourt) {
    if (booking.status !== 'confirmed') return false
    if (booking.payment_status !== 'verified') return false
    if (!booking.booking_reference) return false

    const state = getRescheduleState(booking)

    if (state.loading) return false
    if (state.request?.status === 'approved') return false
    if (state.request?.status === 'pending') return false

    return has24HourNotice(booking)
  }

  function getRescheduleMessage(
    booking: BookingWithCourt
  ): string | null {
    if (booking.status !== 'confirmed') return null
    if (booking.payment_status !== 'verified') return null

    const state = getRescheduleState(booking)

    if (state.request?.status === 'approved') {
      return 'This booking has already used its one reschedule.'
    }

    if (state.request?.status === 'pending') {
      return 'Your reschedule request is pending admin approval.'
    }

    if (!has24HourNotice(booking)) {
      return 'Reschedule is only available at least 24 hours before your scheduled booking.'
    }

    return null
  }

  function closeReschedule() {
    setRescheduleId(null)
    setNewDate('')
    setNewCourtId('')
    setNewTime(null)
    setRescheduleSlots([])
    setRescheduleError('')
  }

  async function openReschedule(booking: BookingWithCourt) {
    if (!canReschedule(booking)) return

    setRescheduleId(booking.id)
    setRescheduleError('')
    setNewTime(null)
    setRescheduleSlots([])

    const today = new Date()
    today.setDate(today.getDate() + 1)

    const isoToday = today.toISOString().slice(0, 10)

    setNewDate(isoToday)

    const availableCourts = courts.filter(
      (court) => court.status === 'available'
    )

    if (availableCourts.length > 0) {
      const firstCourt = availableCourts[0]

      setNewCourtId(firstCourt.id)

      await loadRescheduleSlots(
        firstCourt.id,
        isoToday
      )
    }
  }

  async function loadRescheduleSlots(
    courtId: string,
    date: string
  ) {
    if (!courtId || !date) return

    setLoadingRescheduleSlots(true)
    setRescheduleError('')
    setNewTime(null)

    try {
      const data = await getAvailableSlots(
        courtId,
        date
      )

      setRescheduleSlots(data)
    } catch (err) {
      setRescheduleSlots([])

      setRescheduleError(
        err instanceof Error
          ? err.message
          : 'Failed to load available times'
      )
    } finally {
      setLoadingRescheduleSlots(false)
    }
  }

  async function handleNewDateChange(
    value: string
  ) {
    setNewDate(value)
    setNewTime(null)

    if (newCourtId) {
      await loadRescheduleSlots(
        newCourtId,
        value
      )
    }
  }

  async function handleNewCourtChange(
    value: string
  ) {
    setNewCourtId(value)
    setNewTime(null)

    if (newDate) {
      await loadRescheduleSlots(
        value,
        newDate
      )
    }
  }

  async function submitReschedule(
    booking: BookingWithCourt
  ) {
    if (!booking.booking_reference) {
      setRescheduleError(
        'Booking reference is missing.'
      )
      return
    }

    if (!newDate) {
      setRescheduleError(
        'Please select a new date.'
      )
      return
    }

    if (!newCourtId) {
      setRescheduleError(
        'Please select a court.'
      )
      return
    }

    if (!newTime) {
      setRescheduleError(
        'Please select an available time.'
      )
      return
    }

    setSubmittingReschedule(true)
    setRescheduleError('')

    try {
      await createCustomerRescheduleRequest(
        booking.booking_reference,
        newDate,
        newCourtId,
        newTime.start_time,
        newTime.end_time
      )

      await loadBookings()

      closeReschedule()
    } catch (err) {
      setRescheduleError(
        err instanceof Error
          ? err.message
          : 'Failed to submit reschedule request'
      )
    } finally {
      setSubmittingReschedule(false)
    }
  }

  function statusBadge(
    booking: BookingWithCourt
  ) {
    if (booking.status === 'cancelled') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-line text-muted shrink-0">
          Cancelled
        </span>
      )
    }

    if (booking.payment_status === 'verified') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-court/15 text-court shrink-0">
          Verified
        </span>
      )
    }

    if (booking.payment_status === 'rejected') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-red-950/40 text-red-400 shrink-0">
          Rejected
        </span>
      )
    }

    return (
      <span className="text-xs px-2 py-1 rounded-full bg-line text-muted shrink-0">
        Pending
      </span>
    )
  }

  if (authLoading || loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-muted">
        Loading...
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">
        My bookings
      </h1>

      {error && (
        <p className="text-red-400 mb-4">
          {error}
        </p>
      )}

      {bookings.length === 0 && (
        <div className="border border-line rounded-lg p-8 text-center text-muted">
          No bookings yet.
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((booking) => {
          const canBeCancelled =
            canCancel(booking)

          const canBeRescheduled =
            canReschedule(booking)

          const rescheduleMessage =
            getRescheduleMessage(booking)

          const isRescheduling =
            rescheduleId === booking.id

          return (
            <div
              key={booking.id}
              className="border border-line rounded-lg p-4 bg-surface"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    {booking.courts?.name ?? 'Court'}
                  </p>

                  <p className="text-sm text-muted">
                    {booking.date} ·{' '}
                    {booking.start_time.slice(0, 5)}
                    –
                    {booking.end_time.slice(0, 5)}
                  </p>

                  <p className="text-sm text-muted mt-1">
                    {booking.payment_type === 'deposit'
                      ? 'Deposit'
                      : 'Full payment'}
                    :{' '}
                    <span className="font-medium text-ink">
                      ₱{booking.amount_due ?? '—'}
                    </span>
                  </p>
                </div>

                {statusBadge(booking)}
              </div>

              {booking.status === 'confirmed' && (
                <div className="mt-4 space-y-3">
                  {booking.payment_status === 'verified' && (
                    <div className="border border-line rounded-lg p-3 bg-paper">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-ink">
                            Reschedule
                          </p>

                          <p className="text-xs text-muted mt-1">
                            1 reschedule per booking
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            openReschedule(booking)
                          }
                          disabled={
                            !canBeRescheduled ||
                            isRescheduling
                          }
                          className="text-sm px-3 py-2 rounded-md border border-court/40 text-court hover:bg-court/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {getRescheduleState(booking).request
                            ?.status === 'pending'
                            ? 'Reschedule requested'
                            : getRescheduleState(booking).request
                                ?.status === 'approved'
                            ? 'Rescheduled'
                            : 'Reschedule booking'}
                        </button>
                      </div>

                      {rescheduleMessage && (
                        <p className="text-xs text-muted mt-2">
                          {rescheduleMessage}
                        </p>
                      )}

                      {isRescheduling && (
                        <div className="mt-4 border-t border-line pt-4 space-y-4">
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              Request reschedule
                            </p>

                            <p className="text-xs text-muted mt-1">
                              Choose a new date, court, and available time.
                              Your request will need admin approval.
                            </p>
                          </div>

                          {rescheduleError && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                              <p className="text-sm text-red-400">
                                {rescheduleError}
                              </p>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium text-muted mb-1">
                              New date
                            </label>

                            <input
                              type="date"
                              value={newDate}
                              min={
                                new Date(
                                  Date.now() +
                                    24 * 60 * 60 * 1000
                                )
                                  .toISOString()
                                  .slice(0, 10)
                              }
                              onChange={(event) =>
                                handleNewDateChange(
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-muted mb-1">
                              New court
                            </label>

                            <select
                              value={newCourtId}
                              onChange={(event) =>
                                handleNewCourtChange(
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                            >
                              <option value="">
                                Select court
                              </option>

                              {courts
                                .filter(
                                  (court) =>
                                    court.status ===
                                    'available'
                                )
                                .map((court) => (
                                  <option
                                    key={court.id}
                                    value={court.id}
                                  >
                                    {court.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-muted mb-2">
                              Available time
                            </label>

                            {loadingRescheduleSlots ? (
                              <p className="text-sm text-muted">
                                Loading available times...
                              </p>
                            ) : rescheduleSlots.filter(
                                (slot) =>
                                  slot.available
                              ).length === 0 ? (
                              <div className="rounded-lg border border-line p-4 text-center">
                                <p className="text-sm text-muted">
                                  No available times for this date.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {rescheduleSlots
                                  .filter(
                                    (slot) =>
                                      slot.available
                                  )
                                  .map((slot) => {
                                    const selected =
                                      newTime?.start_time ===
                                        slot.start_time &&
                                      newTime?.end_time ===
                                        slot.end_time

                                    return (
                                      <button
                                        key={`${slot.start_time}-${slot.end_time}`}
                                        type="button"
                                        onClick={() =>
                                          setNewTime(
                                            slot
                                          )
                                        }
                                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                                          selected
                                            ? 'border-court bg-court/15 text-court'
                                            : 'border-line bg-surface text-ink hover:border-court/50'
                                        }`}
                                      >
                                        {slot.start_time.slice(
                                          0,
                                          5
                                        )}{' '}
                                        –{' '}
                                        {slot.end_time.slice(
                                          0,
                                          5
                                        )}
                                      </button>
                                    )
                                  })}
                              </div>
                            )}
                          </div>

                          {newTime && (
                            <div className="rounded-lg border border-court/30 bg-court/5 p-3">
                              <p className="text-xs text-muted">
                                New schedule
                              </p>

                              <p className="text-sm font-medium text-ink mt-1">
                                {newDate} ·{' '}
                                {
                                  courts.find(
                                    (court) =>
                                      court.id ===
                                      newCourtId
                                  )?.name
                                }{' '}
                                ·{' '}
                                {newTime.start_time.slice(
                                  0,
                                  5
                                )}
                                –
                                {newTime.end_time.slice(
                                  0,
                                  5
                                )}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={closeReschedule}
                              disabled={
                                submittingReschedule
                              }
                              className="text-sm px-3 py-2 rounded-md text-muted hover:text-ink disabled:opacity-50"
                            >
                              Close
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                submitReschedule(
                                  booking
                                )
                              }
                              disabled={
                                submittingReschedule ||
                                !newDate ||
                                !newCourtId ||
                                !newTime
                              }
                              className="text-sm px-4 py-2 rounded-md bg-court text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {submittingReschedule
                                ? 'Submitting...'
                                : 'Submit request'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    {canBeCancelled ? (
                      <button
                        onClick={() =>
                          handleCancel(booking.id)
                        }
                        disabled={
                          cancellingId === booking.id
                        }
                        className="text-sm text-red-400 hover:underline disabled:opacity-50"
                      >
                        {cancellingId === booking.id
                          ? 'Cancelling...'
                          : 'Cancel booking'}
                      </button>
                    ) : (
                      <p className="text-xs text-muted/70">
                        Cancellation window has passed
                        (24hrs). Contact admin for changes.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}