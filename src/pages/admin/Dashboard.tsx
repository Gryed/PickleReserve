import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface Stats {
  totalCourts: number
  todayBookings: number
  pendingPayments: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalCourts: 0, todayBookings: 0, pendingPayments: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const today = new Date().toISOString().slice(0, 10)

      const [courtsRes, bookingsRes, pendingRes] = await Promise.all([
        supabase.from('courts').select('id', { count: 'exact', head: true }),
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('date', today)
          .eq('status', 'confirmed'),
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', 'pending')
          .not('payment_proof_url', 'is', null),
      ])

      setStats({
        totalCourts: courtsRes.count ?? 0,
        todayBookings: bookingsRes.count ?? 0,
        pendingPayments: pendingRes.count ?? 0,
      })
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const navItems = [
    { to: '/admin/courts', label: 'Court management', desc: 'Add, edit, or remove courts' },
    { to: '/admin/hours', label: 'Operating hours', desc: 'Set open/closed times per day' },
    { to: '/admin/payments', label: 'Payment settings', desc: 'GCash QR, number, deposit %' },
    { to: '/admin/payments/pending', label: 'Pending payments', desc: 'Verify or reject payment proofs' },
    { to: '/admin/reservations', label: 'Reservations', desc: 'View all bookings and status' },
    { to: '/admin/reports', label: 'Reports', desc: 'Revenue and booking history' },
  ]

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-8">Admin dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="border border-line rounded-lg p-4 bg-surface">
          <p className="text-sm text-muted">Total courts</p>
          <p className="font-display text-2xl font-semibold text-ink">{loading ? '—' : stats.totalCourts}</p>
        </div>
        <div className="border border-line rounded-lg p-4 bg-surface">
          <p className="text-sm text-muted">Today's bookings</p>
          <p className="font-display text-2xl font-semibold text-ink">{loading ? '—' : stats.todayBookings}</p>
        </div>
        <div className="border border-line rounded-lg p-4 bg-surface">
          <p className="text-sm text-muted">Pending payments</p>
          <p className="font-display text-2xl font-semibold text-court">
            {loading ? '—' : stats.pendingPayments}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="border border-line rounded-lg p-4 bg-surface hover:border-court transition-colors"
          >
            <p className="font-medium text-ink">{item.label}</p>
            <p className="text-sm text-muted">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}