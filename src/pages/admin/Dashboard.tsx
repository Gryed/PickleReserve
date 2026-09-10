
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface Stats {
  totalCourts: number
  todayBookings: number
  pendingPayments: number
}

function StatCard({
  icon,
  label,
  value,
  description,
  accent = false,
}: {
  icon: string
  label: string
  value: number | string
  description: string
  accent?: boolean
}) {
  return (
    <div className="pr-card group p-5 transition duration-200 hover:-translate-y-0.5 hover:border-court/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            {label}
          </p>

          <p
            className={`mt-2 font-display text-3xl font-bold tracking-tight ${
              accent ? 'text-court' : 'text-ink'
            }`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs leading-5 text-muted">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-base text-court transition group-hover:border-court/20">
          {icon}
        </div>
      </div>
    </div>
  )
}

const navItems = [
  {
    to: '/admin/courts',
    label: 'Court Management',
    desc: 'Add, edit, or manage your pickleball courts.',
    icon: '🏓',
  },
  {
    to: '/admin/hours',
    label: 'Operating Hours',
    desc: 'Set opening and closing times for each day.',
    icon: '◷',
  },
  {
    to: '/admin/payments',
    label: 'Payment Settings',
    desc: 'Configure GCash, deposit percentage, and payment options.',
    icon: '₱',
  },
  {
    to: '/admin/payments/pending',
    label: 'Pending Payments',
    desc: 'Review and verify submitted payment proofs.',
    icon: '✓',
    accent: true,
  },
  {
    to: '/admin/reservations',
    label: 'Reservations',
    desc: 'View bookings, customers, schedules, and statuses.',
    icon: '▣',
  },
  {
    to: '/admin/reports',
    label: 'Reports',
    desc: 'Review revenue, bookings, and reservation history.',
    icon: '▥',
  },
]

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalCourts: 0,
    todayBookings: 0,
    pendingPayments: 0,
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const today = new Date().toISOString().slice(0, 10)

      const [courtsRes, bookingsRes, pendingRes] =
        await Promise.all([
          supabase
            .from('courts')
            .select('id', {
              count: 'exact',
              head: true,
            }),

          supabase
            .from('reservations')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('date', today)
            .eq('status', 'confirmed'),

          supabase
            .from('reservations')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('payment_status', 'pending')
            .not('payment_proof_url', 'is', null),
        ])

      setStats({
        totalCourts: courtsRes.count ?? 0,
        todayBookings: bookingsRes.count ?? 0,
        pendingPayments: pendingRes.count ?? 0,
      })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="pr-page">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* PAGE HEADER */}
        <section className="mb-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span>Admin</span>
                <span className="text-line">/</span>
                <span className="text-court">Dashboard</span>
              </div>

              <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Admin Dashboard
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                Manage your courts, reservations, payments,
                and booking operations.
              </p>
            </div>

            <Link
              to="/admin/create-booking"
              className="btn-court inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold sm:w-auto"
            >
              <span className="text-base">＋</span>
              Create Booking
            </Link>
          </div>
        </section>

        {/* OVERVIEW */}
        <section className="mb-7">
          <div className="mb-3">
            <h2 className="font-display text-sm font-semibold text-ink">
              Overview
            </h2>

            <p className="mt-0.5 text-xs text-muted">
              Quick summary of today's booking activity.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard
              icon="🏓"
              label="Total Courts"
              value={loading ? '—' : stats.totalCourts}
              description="Courts currently in the system"
            />

            <StatCard
              icon="📅"
              label="Today's Bookings"
              value={loading ? '—' : stats.todayBookings}
              description="Confirmed reservations today"
            />

            <StatCard
              icon="✓"
              label="Pending Payments"
              value={loading ? '—' : stats.pendingPayments}
              description="Payment proofs awaiting review"
              accent
            />
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section>
          <div className="mb-3">
            <h2 className="font-display text-sm font-semibold text-ink">
              Quick Actions
            </h2>

            <p className="mt-0.5 text-xs text-muted">
              Access the main areas of your admin panel.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group pr-card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-court/30 hover:shadow-lg sm:p-5"
              >
                <div className="flex items-start gap-3.5 sm:gap-4">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-base text-court transition group-hover:border-court/30 group-hover:bg-court group-hover:text-paper">
                    {item.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {item.label}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-muted">
                          {item.desc}
                        </p>
                      </div>

                      <span className="shrink-0 text-sm text-muted transition group-hover:translate-x-0.5 group-hover:text-court">
                        →
                      </span>
                    </div>

                    {item.accent && stats.pendingPayments > 0 && (
                      <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-court/20 bg-court/10 px-2.5 py-1 text-[10px] font-semibold text-court">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-court" />

                        <span className="truncate">
                          {stats.pendingPayments}{' '}
                          {stats.pendingPayments === 1
                            ? 'payment'
                            : 'payments'}{' '}
                          to review
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ADMIN BOOKING CTA */}
        <section className="pr-card mt-6 overflow-hidden">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3.5 sm:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-court text-base text-paper">
                🏓
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Need to book a court?
                </p>

                <p className="mt-1 text-xs leading-5 text-muted">
                  Create a reservation directly for a guest,
                  walk-in, or registered customer.
                </p>
              </div>
            </div>

            <Link
              to="/admin/create-booking"
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-court/40 px-4 py-2.5 text-sm font-semibold text-court transition hover:bg-court hover:text-paper sm:w-auto"
            >
              Create Booking
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* FOOTER NOTE */}
        <footer className="py-6 text-center">
          <p className="text-[10px] text-muted">
            PickleReserve Admin
          </p>
        </footer>
      </div>
    </main>
  )
}