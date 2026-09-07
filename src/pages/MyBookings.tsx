import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Reservation } from '../types/availability'
import { getUserReservations, cancelReservation, canCancel } from '../services/availabilityService'
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
      const data = await getUserReservations(user.id)
      setBookings(data as BookingWithCourt[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings')
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
      setError(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setCancellingId(null)
    }
  }

  function statusBadge(b: BookingWithCourt) {
    if (b.status === 'cancelled') {
      return <span className="text-xs px-2 py-1 rounded-full bg-ink/10 text-ink/50 shrink-0">Cancelled</span>
    }
    if (b.payment_status === 'verified') {
      return <span className="text-xs px-2 py-1 rounded-full bg-ball/30 text-court-dark shrink-0">Verified</span>
    }
    if (b.payment_status === 'rejected') {
      return <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 shrink-0">Rejected</span>
    }
    return <span className="text-xs px-2 py-1 rounded-full bg-line text-ink/60 shrink-0">Pending</span>
  }

  if (authLoading || loading) return <div className="p-8 max-w-2xl mx-auto text-ink/60">Loading...</div>

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">My bookings</h1>

      {error && <p className="text-red-700 mb-4">{error}</p>}

      {bookings.length === 0 && (
        <div className="border border-line rounded-lg p-8 text-center text-ink/50">
          No bookings yet.
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((b) => {
          const canBeCancelled = canCancel(b)
          return (
            <div key={b.id} className="border border-line rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{b.courts?.name ?? 'Court'}</p>
                  <p className="text-sm text-ink/50">
                    {b.date} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                  </p>
                  <p className="text-sm text-ink/70 mt-1">
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
                      className="text-sm text-red-700 hover:underline disabled:opacity-50"
                    >
                      {cancellingId === b.id ? 'Cancelling...' : 'Cancel booking'}
                    </button>
                  ) : (
                    <p className="text-xs text-ink/40">
                      Cancellation window has passed (24hrs). Contact admin for changes.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}