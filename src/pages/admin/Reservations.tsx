import { useEffect, useState } from 'react'
import { getAllReservationsAdmin } from '../../services/availabilityService'

interface ReservationRow {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  payment_type: string
  amount_due: number | null
  payment_status: string
  user_id: string | null
  guest_name: string | null
  guest_phone: string | null
  courts: { name: string } | null
}

export default function Reservations() {
  const [rows, setRows] = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const data = await getAllReservationsAdmin()
      setRows(data as unknown as ReservationRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reservations')
    } finally {
      setLoading(false)
    }
  }

  const displayedRows = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  function paymentBadge(status: string) {
    if (status === 'verified') return <span className="text-xs px-2 py-1 rounded-full bg-court/15 text-court">Verified</span>
    if (status === 'rejected') return <span className="text-xs px-2 py-1 rounded-full bg-red-950/40 text-red-400">Rejected</span>
    return <span className="text-xs px-2 py-1 rounded-full bg-line text-muted">Pending</span>
  }

  if (loading) return <div className="p-8 max-w-5xl mx-auto text-muted">Loading...</div>

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Reservations</h1>
        <div className="flex gap-2 text-xs">
          {(['all', 'confirmed', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                'px-3 py-1.5 rounded-full border transition-colors capitalize ' +
                (filter === f ? 'btn-court border-court' : 'border-line text-muted hover:border-court')
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {displayedRows.length === 0 && (
        <div className="border border-line rounded-lg p-8 text-center text-muted">No reservations found.</div>
      )}

      <div className="space-y-2">
        {displayedRows.map((r) => (
          <div key={r.id} className="border border-line rounded-lg p-4 bg-surface flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{r.courts?.name ?? 'Court'}</p>
              <p className="text-sm text-muted">
                {r.date} · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
              </p>
              <p className="text-sm text-muted mt-1">
                {r.user_id ? (
                  <span className="text-court">Registered customer</span>
                ) : (
                  <span>{r.guest_name} · {r.guest_phone}</span>
                )}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-ink font-medium">₱{r.amount_due ?? '—'}</p>
              <p className="text-xs text-muted mb-1">{r.payment_type}</p>
              <div className="flex items-center gap-2 justify-end">
                {paymentBadge(r.payment_status)}
                <span
                  className={
                    'text-xs px-2 py-1 rounded-full ' +
                    (r.status === 'cancelled' ? 'bg-line text-muted' : 'bg-court/15 text-court')
                  }
                >
                  {r.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}