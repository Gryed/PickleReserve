import { useEffect, useState } from 'react'
import { getReservationsInRange, calculateRevenue, exportToCSV, type ReportRow } from '../../services/reportService'

function firstDayOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function Reports() {
  const [startDate, setStartDate] = useState(firstDayOfMonth())
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadReport()
  }, [startDate, endDate])

  async function loadReport() {
    setLoading(true)
    setError('')
    try {
      const data = await getReservationsInRange(startDate, endDate)
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const revenue = calculateRevenue(rows)
  const confirmedCount = rows.filter((r) => r.status === 'confirmed').length

  function paymentBadge(status: string) {
    if (status === 'verified') return <span className="text-court">verified</span>
    if (status === 'rejected') return <span className="text-red-400">rejected</span>
    return <span className="text-muted">pending</span>
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Reports</h1>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-surface border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-surface border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
          />
        </div>
        <button
          onClick={() => exportToCSV(rows)}
          disabled={rows.length === 0}
          className="btn-court px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="border border-line rounded-lg p-4 bg-surface">
          <p className="text-sm text-muted">Total revenue (verified)</p>
          <p className="font-display text-2xl font-semibold text-court">₱{revenue.toLocaleString()}</p>
        </div>
        <div className="border border-line rounded-lg p-4 bg-surface">
          <p className="text-sm text-muted">Confirmed bookings</p>
          <p className="font-display text-2xl font-semibold text-ink">{confirmedCount}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="border border-line rounded-lg p-8 text-center text-muted">
          No bookings in this date range.
        </div>
      ) : (
        <div className="overflow-x-auto border border-line rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Time</th>
                <th className="text-left px-3 py-2 font-medium">Court</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Amount</th>
                <th className="text-left px-3 py-2 font-medium">Payment</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-2 text-ink">{r.date}</td>
                  <td className="px-3 py-2 text-ink">
                    {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                  </td>
                  <td className="px-3 py-2 text-ink">{r.court_name}</td>
                  <td className="px-3 py-2 text-muted">{r.payment_type}</td>
                  <td className="px-3 py-2 text-ink">₱{r.amount_due ?? '—'}</td>
                  <td className="px-3 py-2">{paymentBadge(r.payment_status)}</td>
                  <td className="px-3 py-2 text-muted">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}