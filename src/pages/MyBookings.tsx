import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Reservation } from '../types/availability'

import {
  getUserReservations,
  cancelReservation,
  canCancel,
} from '../services/availabilityService'

import { useAuth } from '../context/AuthContext'

interface BookingWithCourt extends Reservation {
  courts: { name: string } | null
}

export default function MyBookings() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [bookings, setBookings] = useState<BookingWithCourt[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  const [cancellingId, setCancellingId] = useState<string | null>(null)

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

      const bookingData = await getUserReservations(user.id)

      const userBookings = bookingData as BookingWithCourt[]

      setBookings(userBookings)
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
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-ink">
                            Need to reschedule?
                          </p>

                          <p className="text-xs text-muted mt-1">
                            Send us a message on Messenger with your booking reference. An admin will check availability and update your booking. Changes are not confirmed until an admin replies.
                          </p>
                        </div>

                        <span
                          aria-disabled="true"
                          className="shrink-0 cursor-not-allowed rounded-md border border-line px-3 py-2 text-center text-sm text-muted opacity-70"
                        >
                          Message us on Messenger
                        </span>
                      </div>
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
