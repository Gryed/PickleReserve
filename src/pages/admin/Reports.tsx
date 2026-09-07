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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <button
          onClick={() => exportToCSV(rows)}
          disabled={rows.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Revenue (verified)</p>
          <p className="text-2xl font-bold text-green-600">₱{revenue.toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Confirmed Bookings</p>
          <p className="text-2xl font-bold">{confirmedCount}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">No bookings in this date range.</p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Court</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">Payment</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">
                    {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                  </td>
                  <td className="px-3 py-2">{r.court_name}</td>
                  <td className="px-3 py-2">{r.payment_type}</td>
                  <td className="px-3 py-2">₱{r.amount_due ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.payment_status === 'verified'
                          ? 'text-green-600'
                          : r.payment_status === 'rejected'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }
                    >
                      {r.payment_status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}