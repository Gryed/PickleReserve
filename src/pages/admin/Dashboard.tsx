import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

interface Stats {
  totalCourts: number
  todayBookings: number
  pendingPayments: number
}

export default function Dashboard() {
  const { signOut } = useAuth()
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
      // silently fail, stats just show 0
    } finally {
      setLoading(false)
    }
  }

  const navItems = [
    { to: '/admin/courts', label: 'Court management', desc: 'Add, edit, or remove courts' },
    { to: '/admin/hours', label: 'Operating hours', desc: 'Set open/closed times per day' },
    { to: '/admin/payments', label: 'Payment settings', desc: 'GCash QR, number, deposit %' },
    { to: '/admin/payments/pending', label: 'Pending payments', desc: 'Verify or reject payment proofs' },
    { to: '/admin/reports', label: 'Reports', desc: 'Revenue and booking history' },
  { to: '/admin/reservations', label: 'Reservations', desc: 'View all bookings and status' },
  ]

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Admin dashboard</h1>
        <button onClick={signOut} className="text-sm text-ink/60 hover:text-red-700 transition-colors">
          Log out
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="border border-line rounded-lg p-4 bg-white">
          <p className="text-sm text-ink/50">Total courts</p>
          <p className="font-display text-2xl font-semibold text-ink">{loading ? '—' : stats.totalCourts}</p>
        </div>
        <div className="border border-line rounded-lg p-4 bg-white">
          <p className="text-sm text-ink/50">Today's bookings</p>
          <p className="font-display text-2xl font-semibold text-ink">{loading ? '—' : stats.todayBookings}</p>
        </div>
        <div className="border border-line rounded-lg p-4 bg-white">
          <p className="text-sm text-ink/50">Pending payments</p>
          <p className="font-display text-2xl font-semibold text-court-dark">
            {loading ? '—' : stats.pendingPayments}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="border border-line rounded-lg p-4 bg-white hover:border-court transition-colors"
          >
            <p className="font-medium text-ink">{item.label}</p>
            <p className="text-sm text-ink/50">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}