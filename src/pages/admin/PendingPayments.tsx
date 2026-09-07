import { useEffect, useState } from 'react'
import { getPendingPayments, updatePaymentStatus } from '../../services/paymentService'

interface PendingReservation {
  id: string
  date: string
  start_time: string
  end_time: string
  payment_type: string
  amount_due: number | null
  payment_proof_url: string | null
  user_id: string | null
  guest_name: string | null
  guest_phone: string | null
  courts: { name: string } | null
}

export default function PendingPayments() {
  const [payments, setPayments] = useState<PendingReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadPayments()
  }, [])

  async function loadPayments() {
    try {
      setLoading(true)
      const data = await getPendingPayments()
      setPayments(data as unknown as PendingReservation[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(id: string, status: 'verified' | 'rejected') {
    setProcessingId(id)
    setError('')
    try {
      await updatePaymentStatus(id, status)
      await loadPayments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Pending Payments</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {payments.length === 0 && <p className="text-gray-500">No pending payments.</p>}

      <div className="space-y-4">
        {payments.map((p) => (
          <div key={p.id} className="border rounded-lg p-4 flex flex-col sm:flex-row gap-4">
            {p.payment_proof_url && (
              <img
                src={p.payment_proof_url}
                alt="Payment proof"
                className="w-32 h-32 object-cover border rounded shrink-0"
              />
            )}
            <div className="flex-1">
              <p className="font-medium">{p.courts?.name ?? 'Court'}</p>
              <p className="text-sm text-gray-500">
                {p.date} · {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
              </p>

              <div className="text-sm mt-2">
                {p.user_id ? (
                  <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                    Registered customer
                  </span>
                ) : (
                  <div className="inline-block bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded">
                    Guest: {p.guest_name} · {p.guest_phone}
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-700 mt-1">
                {p.payment_type === 'deposit' ? 'Deposit' : 'Full payment'}: ₱{p.amount_due ?? '—'}
              </p>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAction(p.id, 'verified')}
                  disabled={processingId === p.id}
                  className="bg-green-600 text-white text-sm px-4 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  onClick={() => handleAction(p.id, 'rejected')}
                  disabled={processingId === p.id}
                  className="bg-red-600 text-white text-sm px-4 py-1.5 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}