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

interface BookingSummary {
  bookingReference: string
  rows: BookingWithCourt[]
  customerName: string
  phone: string | null
  date: string
  courtNames: string[]
  startTime: string
  endTime: string
  totalAmount: number
  paymentType: string
  paymentStatus: BookingWithCourt['payment_status']
  status: BookingWithCourt['status']
}

export default function FindBooking() {
  const [searchMode, setSearchMode] =
    useState<'phone' | 'reference'>('reference')

  const [query, setQuery] = useState('')

  const [bookings, setBookings] =
    useState<BookingWithCourt[] | null>(null)

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')

  const [cancellingId, setCancellingId] =
    useState<string | null>(null)

  /* =========================================================
     HELPERS
  ========================================================= */

  function customerName(
    booking: BookingWithCourt
  ) {
    return (
      booking.guest_name?.trim() ||
      'Registered customer'
    )
  }

  function formatTime(time: string) {
    const [hourString, minute] =
      time.slice(0, 5).split(':')

    let hour = Number(hourString)

    const period =
      hour >= 12 ? 'PM' : 'AM'

    hour = hour % 12

    if (hour === 0) {
      hour = 12
    }

    return `${hour}:${minute} ${period}`
  }

  function formatDate(date: string) {
    const parsed = new Date(
      `${date}T00:00:00`
    )

    if (Number.isNaN(parsed.getTime())) {
      return date
    }

    return parsed.toLocaleDateString(
      undefined,
      {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }
    )
  }

  function statusBadge(
    booking: BookingSummary
  ) {
    if (
      booking.status ===
      'cancelled'
    ) {
      return (
        <span className="shrink-0 rounded-full bg-line px-2.5 py-1 text-xs text-muted">
          Cancelled
        </span>
      )
    }

    if (
      booking.paymentStatus ===
      'verified'
    ) {
      return (
        <span className="shrink-0 rounded-full bg-court/15 px-2.5 py-1 text-xs text-court">
          Verified
        </span>
      )
    }

    if (
      booking.paymentStatus ===
      'rejected'
    ) {
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

  /* =========================================================
     GROUP BOOKINGS
  ========================================================= */

  function createBookingSummaries(
    rows: BookingWithCourt[]
  ): BookingSummary[] {
    const groups = new Map<
      string,
      BookingWithCourt[]
    >()

    rows.forEach((row) => {
      const key =
        row.booking_reference?.trim() ||
        row.id

      const existing =
        groups.get(key) ?? []

      existing.push(row)

      groups.set(key, existing)
    })

    return Array.from(
      groups.entries()
    ).map(
      ([
        bookingReference,
        group,
      ]) => {
        const sortedRows = [
          ...group,
        ].sort((a, b) => {
          const aTime =
            a.start_time

          const bTime =
            b.start_time

          return aTime.localeCompare(
            bTime
          )
        })

        const first =
          sortedRows[0]

        const last =
          sortedRows[
            sortedRows.length - 1
          ]

        const courtNames = Array.from(
          new Set(
            sortedRows.map(
              (row) =>
                row.courts?.name ??
                'Court'
            )
          )
        )

        const totalAmount =
          sortedRows.reduce(
            (total, row) =>
              total +
              Number(
                row.amount_due ?? 0
              ),
            0
          )

        return {
          bookingReference,
          rows: sortedRows,

          customerName:
            customerName(first),

          phone:
            first.guest_phone ??
            null,

          date: first.date,

          courtNames,

          startTime:
            first.start_time,

          endTime:
            last.end_time,

          totalAmount,

          paymentType:
            first.payment_type ===
            'deposit'
              ? 'Deposit'
              : 'Full payment',

          paymentStatus:
            first.payment_status,

          status:
            first.status,
        }
      }
    )
  }

  /* =========================================================
     SEARCH
  ========================================================= */

  async function handleSearch(
    e: React.FormEvent
  ) {
    e.preventDefault()

    if (!query.trim()) return

    setLoading(true)
    setError('')

    try {
      const data =
        searchMode ===
        'reference'
          ? await getReservationsByReference(
              query.trim()
            )
          : await getGuestReservationsByPhone(
              query.trim()
            )

      setBookings(
        data as BookingWithCourt[]
      )
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

    try {
      const data =
        searchMode ===
        'reference'
          ? await getReservationsByReference(
              query.trim()
            )
          : await getGuestReservationsByPhone(
              query.trim()
            )

      setBookings(
        data as BookingWithCourt[]
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to refresh bookings'
      )
    }
  }

  /* =========================================================
     CANCEL
  ========================================================= */

  async function handleCancel(
    booking: BookingSummary
  ) {
    const confirmed =
      window.confirm(
        'Are you sure you want to cancel this booking?\n\nThis action cannot be undone.'
      )

    if (!confirmed) return

    /*
     * Cancel the first reservation row.
     *
     * The existing cancelReservation()
     * flow handles the booking cancellation.
     */
    const reservationId =
      booking.rows[0]?.id

    if (!reservationId) return

    setCancellingId(
      reservationId
    )

    setError('')

    try {
      await cancelReservation(
        reservationId
      )

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

  /* =========================================================
     SUMMARY DATA
  ========================================================= */

  const summaries =
    bookings &&
    bookings.length > 0
      ? createBookingSummaries(
          bookings
        )
      : []

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6 md:p-8">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
          Find my booking
        </h1>

        <p className="text-sm text-muted">
          Search using your booking
          reference or phone number.
        </p>
      </div>

      {/* SEARCH MODE */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setSearchMode(
              'reference'
            )
            setBookings(null)
            setQuery('')
            setError('')
          }}
          className={
            'rounded-full border px-4 py-2 text-sm transition-colors ' +
            (searchMode ===
            'reference'
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
          type={
            searchMode ===
            'phone'
              ? 'tel'
              : 'text'
          }
          placeholder={
            searchMode ===
            'reference'
              ? 'e.g. PR-2026-00002'
              : 'Phone number'
          }
          value={query}
          onChange={(e) =>
            setQuery(
              e.target.value
            )
          }
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-court"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="btn-court rounded-md px-6 py-2.5 font-medium transition-colors disabled:opacity-50"
        >
          {loading
            ? 'Searching...'
            : 'Search'}
        </button>
      </form>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* EMPTY */}
      {bookings !== null &&
        bookings.length === 0 && (
          <div className="rounded-lg border border-line p-8 text-center text-muted">
            <p className="mb-1 font-medium text-ink">
              No bookings found
            </p>

            <p className="text-sm">
              Check your booking
              reference or phone
              number and try again.
            </p>
          </div>
        )}

      {/* RESULTS */}
      {summaries.length > 0 && (
        <div className="space-y-3">
          {/* RESULT COUNT */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {summaries.length}{' '}
              {summaries.length === 1
                ? 'booking'
                : 'bookings'}{' '}
              found
            </p>
          </div>

          {/* BOOKING SUMMARY CARDS */}
          {summaries.map(
            (booking) => {
              const canBeCancelled =
                booking.rows.some(
                  (row) =>
                    canCancel(row)
                )

              const cancelling =
                booking.rows.some(
                  (row) =>
                    cancellingId ===
                    row.id
                )

              return (
                <div
                  key={
                    booking.bookingReference
                  }
                  className="overflow-hidden rounded-xl border border-line bg-surface"
                >
                  {/* TOP */}
                  <div className="border-b border-line p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-medium text-court">
                          Booking
                          reference
                        </p>

                        <p className="break-all font-display text-lg font-semibold text-ink">
                          {
                            booking.bookingReference
                          }
                        </p>
                      </div>

                      {statusBadge(
                        booking
                      )}
                    </div>
                  </div>

                  {/* MAIN SUMMARY */}
                  <div className="p-4">
                    {/* CUSTOMER */}
                    <div className="mb-4">
                      <p className="text-xs text-muted">
                        Customer
                      </p>

                      <p className="mt-0.5 font-medium text-ink">
                        {
                          booking.customerName
                        }
                      </p>

                      {booking.phone && (
                        <p className="mt-0.5 text-sm text-muted">
                          {
                            booking.phone
                          }
                        </p>
                      )}
                    </div>

                    {/* DATE / COURT */}
                    <div className="grid grid-cols-1 gap-3 rounded-lg bg-paper p-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted">
                          Date
                        </p>

                        <p className="mt-0.5 text-sm font-medium text-ink">
                          {formatDate(
                            booking.date
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted">
                          Court
                        </p>

                        <p className="mt-0.5 text-sm font-medium text-ink">
                          {booking.courtNames.join(
                            ', '
                          )}
                        </p>
                      </div>

                      {/* TIME */}
                      <div>
                        <p className="text-xs text-muted">
                          Time
                        </p>

                        <p className="mt-0.5 text-base font-semibold text-ink">
                          {formatTime(
                            booking.startTime
                          )}{' '}
                          –{' '}
                          {formatTime(
                            booking.endTime
                          )}
                        </p>
                      </div>

                      {/* DURATION */}
                      <div>
                        <p className="text-xs text-muted">
                          Slots
                        </p>

                        <p className="mt-0.5 text-sm font-medium text-ink">
                          {
                            booking
                              .rows
                              .length
                          }{' '}
                          {booking.rows
                            .length ===
                          1
                            ? 'hour'
                            : 'hours'}
                        </p>
                      </div>

                      {/* PAYMENT */}
                      <div>
                        <p className="text-xs text-muted">
                          Payment
                        </p>

                        <p className="mt-0.5 text-sm font-medium text-ink">
                          {
                            booking.paymentType
                          }
                        </p>
                      </div>

                      {/* AMOUNT */}
                      <div>
                        <p className="text-xs text-muted">
                          Total amount
                        </p>

                        <p className="mt-0.5 text-base font-semibold text-ink">
                          ₱
                          {booking.totalAmount.toLocaleString(
                            'en-PH',
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    {/* ACTIONS */}
                    {booking.status ===
                      'confirmed' && (
                      <div className="mt-4 border-t border-line pt-3">
                        {canBeCancelled ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleCancel(
                                booking
                              )
                            }
                            disabled={
                              cancelling
                            }
                            className="rounded-md border border-red-900/50 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-950/30 disabled:opacity-50"
                          >
                            {cancelling
                              ? 'Cancelling...'
                              : 'Cancel booking'}
                          </button>
                        ) : (
                          <p className="text-xs leading-relaxed text-muted/70">
                            Cancellation
                            window has
                            passed (24
                            hours). Contact
                            admin for
                            changes,
                            including
                            rescheduling.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            }
          )}
        </div>
      )}
    </div>
  )
}