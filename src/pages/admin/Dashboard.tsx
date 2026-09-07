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
    { to: '/admin/courts', label: 'Court Management', desc: 'Add, edit, or remove courts' },
    { to: '/admin/hours', label: 'Operating Hours', desc: 'Set open/closed times per day' },
    { to: '/admin/payments', label: 'Payment Settings', desc: 'GCash QR, number, deposit %' },
    { to: '/admin/payments/pending', label: 'Pending Payments', desc: 'Verify or reject payment proofs' },
    { to: '/admin/reports', label: 'Reports', desc: 'Revenue and booking history' },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button onClick={signOut} className="text-sm text-red-600 hover:underline">
          Logout
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Courts</p>
          <p className="text-2xl font-bold">{loading ? '—' : stats.totalCourts}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Today's Bookings</p>
          <p className="text-2xl font-bold">{loading ? '—' : stats.todayBookings}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Pending Payments</p>
          <p className="text-2xl font-bold text-yellow-600">{loading ? '—' : stats.pendingPayments}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <p className="font-medium">{item.label}</p>
            <p className="text-sm text-gray-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}