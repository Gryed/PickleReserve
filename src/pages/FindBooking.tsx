import { useState } from 'react'
import type { Reservation } from '../types/availability'
import {
  getGuestReservationsByPhone,
  getReservationsByReference,
  cancelReservation,
  canCancel,
} from '../services/availabilityService'

interface BookingWithCourt extends Reservation {
  courts: { name: string } | null
}

export default function FindBooking() {
  const [searchMode, setSearchMode] = useState<'phone' | 'reference'>('reference')
  const [query, setQuery] = useState('')
  const [bookings, setBookings] = useState<BookingWithCourt[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()

    if (!query.trim()) return

    setLoading(true)
    setError('')

    try {
      const data =
        searchMode === 'reference'
          ? await getReservationsByReference(query.trim())
          : await getGuestReservationsByPhone(query.trim())

      setBookings(data as BookingWithCourt[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to search bookings'
      )
      setBookings(null)
    } finally {
      setLoading(false)
    }
  }

  async function refreshResults() {
    if (!query.trim()) return

    const data =
      searchMode === 'reference'
        ? await getReservationsByReference(query.trim())
        : await getGuestReservationsByPhone(query.trim())

    setBookings(data as BookingWithCourt[])
  }

  async function handleCancel(id: string) {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this booking?\n\nThis action cannot be undone.'
    )

    if (!confirmed) return

    setCancellingId(id)
    setError('')

    try {
      await cancelReservation(id)
      await refreshResults()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to cancel booking'
      )
    } finally {
      setCancellingId(null)
    }
  }

  function statusBadge(booking: BookingWithCourt) {
    if (booking.status === 'cancelled') {
      return (
        <span className="shrink-0 rounded-full bg-line px-2.5 py-1 text-xs text-muted">
          Cancelled
        </span>
      )
    }

    if (booking.payment_status === 'verified') {
      return (
        <span className="shrink-0 rounded-full bg-court/15 px-2.5 py-1 text-xs text-court">
          Verified
        </span>
      )
    }

    if (booking.payment_status === 'rejected') {
      return (
        <span className="shrink-0 rounded-full bg-red-950/40 px-2.5 py-1 text-xs text-red-400">
          Rejected
        </span>
      )
    }

    return (
      <span className="shrink-0 rounded-full bg-line px-2.5 py-1 text-xs text-muted">
        Pending
      </span>
    )
  }

  function customerName(booking: BookingWithCourt) {
    return booking.guest_name?.trim() || 'Registered customer'
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6 md:p-8">
      <div className="mb-6">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
          Find my booking
        </h1>

        <p className="text-sm text-muted">
          Search using your booking reference or phone number.
        </p>
      </div>

      {/* SEARCH MODE */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setSearchMode('reference')
            setBookings(null)
            setQuery('')
            setError('')
          }}
          className={
            'rounded-full border px-4 py-2 text-sm transition-colors ' +
            (searchMode === 'reference'
              ? 'btn-court border-court'
              : 'border-line text-muted hover:border-court')
          }
        >
          Booking reference
        </button>

        <button
          type="button"
          onClick={() => {
            setSearchMode('phone')
            setBookings(null)
            setQuery('')
            setError('')
          }}
          className={
            'rounded-full border px-4 py-2 text-sm transition-colors ' +
            (searchMode === 'phone'
              ? 'btn-court border-court'
              : 'border-line text-muted hover:border-court')
          }
        >
          Phone number
        </button>
      </div>

      {/* SEARCH FORM */}
      <form
        onSubmit={handleSearch}
        className="mb-6 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type={searchMode === 'phone' ? 'tel' : 'text'}
          placeholder={
            searchMode === 'reference'
              ? 'e.g. PR-2026-00002'
              : 'Phone number'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-court"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="btn-court rounded-md px-6 py-2.5 font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* EMPTY */}
      {bookings !== null && bookings.length === 0 && (
        <div className="rounded-lg border border-line p-8 text-center text-muted">
          <p className="mb-1 font-medium text-ink">
            No bookings found
          </p>

          <p className="text-sm">
            Check your booking reference or phone number and try again.
          </p>
        </div>
      )}

      {/* RESULTS */}
      {bookings && bookings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {bookings.length}{' '}
              {bookings.length === 1 ? 'booking' : 'booking slots'} found
            </p>
          </div>

          {bookings.map((booking) => {
            const canBeCancelled = canCancel(booking)

            return (
              <div
                key={booking.id}
                className="rounded-xl border border-line bg-surface p-4"
              >
                {/* HEADER */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {booking.booking_reference && (
                      <p className="mb-1 break-all text-xs font-medium text-court">
                        {booking.booking_reference}
                      </p>
                    )}

                    <p className="font-display text-lg font-semibold text-ink">
                      {customerName(booking)}
                    </p>

                    <p className="mt-0.5 font-medium text-ink">
                      {booking.courts?.name ?? 'Court'}
                    </p>
                  </div>

                  {statusBadge(booking)}
                </div>

                {/* DETAILS */}
                <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-paper p-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted">
                      Date
                    </p>
                    <p className="text-sm font-medium text-ink">
                      {booking.date}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted">
                      Time
                    </p>
                    <p className="text-sm font-medium text-ink">
                      {booking.start_time.slice(0, 5)}–
                      {booking.end_time.slice(0, 5)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted">
                      Payment
                    </p>
                    <p className="text-sm font-medium capitalize text-ink">
                      {booking.payment_type === 'deposit'
                        ? 'Deposit'
                        : 'Full payment'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted">
                      Amount
                    </p>
                    <p className="text-sm font-medium text-ink">
                      ₱{booking.amount_due ?? '—'}
                    </p>
                  </div>

                  {booking.guest_phone && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted">
                        Contact number
                      </p>
                      <p className="text-sm font-medium text-ink">
                        {booking.guest_phone}
                      </p>
                    </div>
                  )}
                </div>

                {/* CANCEL */}
                {booking.status === 'confirmed' && (
                  <div className="mt-4 border-t border-line pt-3">
                    {canBeCancelled ? (
                      <button
                        type="button"
                        onClick={() => handleCancel(booking.id)}
                        disabled={cancellingId === booking.id}
                        className="rounded-md border border-red-900/50 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-950/30 disabled:opacity-50"
                      >
                        {cancellingId === booking.id
                          ? 'Cancelling...'
                          : 'Cancel booking'}
                      </button>
                    ) : (
                      <p className="text-xs leading-relaxed text-muted/70">
                        Cancellation window has passed (24 hours).
                        Contact admin for changes.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
