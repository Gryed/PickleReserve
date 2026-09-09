import { useState } from 'react'
import type { Reservation } from '../types/availability'
import { getGuestReservationsByPhone, cancelReservation, canCancel } from '../services/availabilityService'

interface BookingWithCourt extends Reservation {
  courts: { name: string } | null
}

export default function FindBooking() {
  const [phone, setPhone] = useState('')
  const [bookings, setBookings] = useState<BookingWithCourt[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return

    setLoading(true)
    setError('')
    try {
      const data = await getGuestReservationsByPhone(phone)
      setBookings(data as BookingWithCourt[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search')
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
      const data = await getGuestReservationsByPhone(phone)
      setBookings(data as BookingWithCourt[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setCancellingId(null)
    }
  }

  function statusBadge(b: BookingWithCourt) {
    if (b.status === 'cancelled') {
      return <span className="text-xs px-2 py-1 rounded-full bg-line text-muted shrink-0">Cancelled</span>
    }
    if (b.payment_status === 'verified') {
      return <span className="text-xs px-2 py-1 rounded-full bg-court/15 text-court shrink-0">Verified</span>
    }
    if (b.payment_status === 'rejected') {
      return <span className="text-xs px-2 py-1 rounded-full bg-red-950/40 text-red-400 shrink-0">Rejected</span>
    }
    return <span className="text-xs px-2 py-1 rounded-full bg-line text-muted shrink-0">Pending</span>
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-1">Find my booking</h1>
      <p className="text-muted mb-6">Booked as a guest? Enter your phone number to view your bookings.</p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1 bg-surface border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-court px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {bookings !== null && bookings.length === 0 && (
        <div className="border border-line rounded-lg p-8 text-center text-muted">
          No bookings found for this phone number.
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <div className="space-y-3">
          {bookings.map((b) => {
            const canBeCancelled = canCancel(b)
            return (
              <div key={b.id} className="border border-line rounded-lg p-4 bg-surface">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{b.courts?.name ?? 'Court'}</p>
                    <p className="text-sm text-muted">
                      {b.date} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                    </p>
                    <p className="text-sm text-muted mt-1">
                      {b.payment_type === 'deposit' ? 'Deposit' : 'Full payment'}:{' '}
                      <span className="font-medium text-ink">₱{b.amount_due ?? '—'}</span>
                    </p>
                  </div>
                  {statusBadge(b)}
                </div>

                {b.status === 'confirmed' && (
                  <div className="mt-3">
                    {canBeCancelled ? (
                      <button
                        onClick={() => handleCancel(b.id)}
                        disabled={cancellingId === b.id}
                        className="text-sm text-red-400 hover:underline disabled:opacity-50"
                      >
                        {cancellingId === b.id ? 'Cancelling...' : 'Cancel booking'}
                      </button>
                    ) : (
                      <p className="text-xs text-muted/70">
                        Cancellation window has passed (24hrs). Contact admin for changes.
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