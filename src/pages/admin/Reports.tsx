import { useEffect, useMemo, useState } from 'react'
import {
  calculateRevenue,
  exportToCSV,
  getReservationsInRange,
  type ReportRow,
} from '../../services/reportService'

type QuickRange =
  | 'today'
  | 'week'
  | 'month'
  | 'custom'

type PaymentFilter =
  | 'all'
  | 'pending'
  | 'verified'
  | 'rejected'

type BookingFilter =
  | 'all'
  | 'confirmed'
  | 'cancelled'

function formatDate(date: string) {
  if (!date) return ''

  const parsed = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonth() {
  const d = new Date()

  return new Date(
    d.getFullYear(),
    d.getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10)
}

function firstDayOfWeek() {
  const d = new Date()
  const day = d.getDay()

  const diff = day === 0 ? -6 : 1 - day

  const first = new Date(d)

  first.setDate(d.getDate() + diff)

  return first.toISOString().slice(0, 10)
}

export default function Reports() {
  const [quickRange, setQuickRange] =
    useState<QuickRange>('month')

  const [startDate, setStartDate] =
    useState(firstDayOfMonth())

  const [endDate, setEndDate] =
    useState(todayString())

  const [rows, setRows] =
    useState<ReportRow[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [search, setSearch] =
    useState('')

  const [courtFilter, setCourtFilter] =
    useState('all')

  const [paymentFilter, setPaymentFilter] =
    useState<PaymentFilter>('all')

  const [bookingFilter, setBookingFilter] =
    useState<BookingFilter>('all')

  const [showFilters, setShowFilters] =
    useState(false)

  /* =====================================================
     LOAD REPORT
  ===================================================== */

  async function loadReport() {
    if (!startDate || !endDate) {
      return
    }

    if (startDate > endDate) {
      setError(
        'Start date cannot be later than end date.'
      )
      return
    }

    try {
      setLoading(true)
      setError('')

      const data =
        await getReservationsInRange(
          startDate,
          endDate
        )

      setRows(data)
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load report.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [startDate, endDate])

  /* =====================================================
     QUICK DATE RANGE
  ===================================================== */

  function applyQuickRange(
    range: QuickRange
  ) {
    setQuickRange(range)

    if (range === 'today') {
      const today = todayString()

      setStartDate(today)
      setEndDate(today)

      return
    }

    if (range === 'week') {
      setStartDate(firstDayOfWeek())
      setEndDate(todayString())

      return
    }

    if (range === 'month') {
      setStartDate(firstDayOfMonth())
      setEndDate(todayString())

      return
    }
  }

  /* =====================================================
     COURT OPTIONS
  ===================================================== */

  const courtOptions =
    useMemo(() => {
      const courts = new Set<string>()

      rows.forEach((row) => {
        if (row.court_name) {
          courts.add(row.court_name)
        }
      })

      return Array.from(courts).sort(
        (a, b) =>
          a.localeCompare(b)
      )
    }, [rows])

  /* =====================================================
     FILTERED REPORT
  ===================================================== */

  const filteredRows =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase()

      return rows.filter((row) => {
        if (
          courtFilter !== 'all' &&
          row.court_name !==
            courtFilter
        ) {
          return false
        }

        if (
          paymentFilter !== 'all' &&
          row.payment_status !==
            paymentFilter
        ) {
          return false
        }

        if (
          bookingFilter !== 'all' &&
          row.status !==
            bookingFilter
        ) {
          return false
        }

        if (
          normalizedSearch
        ) {
          const searchable = [
            row.court_name,
            row.payment_type,
            row.payment_status,
            row.status,
            row.date,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          if (
            !searchable.includes(
              normalizedSearch
            )
          ) {
            return false
          }
        }

        return true
      })
    }, [
      rows,
      search,
      courtFilter,
      paymentFilter,
      bookingFilter,
    ])

  /* =====================================================
     SUMMARY
  ===================================================== */

  const revenue =
    calculateRevenue(
      filteredRows
    )

  const confirmedCount =
    filteredRows.filter(
      (row) =>
        row.status ===
        'confirmed'
    ).length

  const cancelledCount =
    filteredRows.filter(
      (row) =>
        row.status ===
        'cancelled'
    ).length

  const pendingPaymentCount =
    filteredRows.filter(
      (row) =>
        row.payment_status ===
        'pending'
    ).length

  const verifiedPaymentCount =
    filteredRows.filter(
      (row) =>
        row.payment_status ===
        'verified'
    ).length

  const rejectedPaymentCount =
    filteredRows.filter(
      (row) =>
        row.payment_status ===
        'rejected'
    ).length

  const totalAmount =
    filteredRows.reduce(
      (sum, row) =>
        sum +
        Number(
          row.amount_due ?? 0
        ),
      0
    )

  /* =====================================================
     CLEAR FILTERS
  ===================================================== */

  function clearFilters() {
    setSearch('')
    setCourtFilter('all')
    setPaymentFilter('all')
    setBookingFilter('all')
  }

  const hasFilters =
    search.trim() !== '' ||
    courtFilter !== 'all' ||
    paymentFilter !== 'all' ||
    bookingFilter !== 'all'

  /* =====================================================
     PAYMENT BADGE
  ===================================================== */

  function paymentBadge(
    status: string
  ) {
    if (
      status === 'verified'
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-court/20 bg-court/10 px-2.5 py-1 text-[10px] font-semibold text-court">
          <span>✓</span>
          Verified
        </span>
      )
    }

    if (
      status === 'rejected'
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[10px] font-semibold text-red-400">
          <span>✕</span>
          Rejected
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1 text-[10px] font-semibold text-yellow-300">
        <span>⏳</span>
        Pending
      </span>
    )
  }

  /* =====================================================
     BOOKING STATUS
  ===================================================== */

  function bookingBadge(
    status: string
  ) {
    if (
      status === 'cancelled'
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[10px] font-semibold text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-muted" />
          Cancelled
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[10px] font-semibold text-blue-400">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
        Confirmed
      </span>
    )
  }

  /* =====================================================
     EXPORT
  ===================================================== */

  function handleExport() {
    if (
      filteredRows.length === 0
    ) {
      return
    }

    exportToCSV(
      filteredRows
    )
  }

  return (
    <main className="pr-page">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <section className="mb-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span>Admin</span>
                <span className="text-line">
                  /
                </span>
                <span className="text-court">
                  Reports
                </span>
              </div>

              <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Reports
              </h1>

              <p className="mt-1.5 text-sm leading-6 text-muted">
                Monitor reservations, payments, revenue, and court activity.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-muted transition hover:border-court/30 hover:text-court disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <span
                className={
                  loading
                    ? 'animate-spin'
                    : ''
                }
              >
                ↻
              </span>

              {loading
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </div>
        </section>

        {/* =================================================
            QUICK RANGE
        ================================================= */}

        <section className="pr-card mb-6 p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Report Period
            </p>

            <p className="mt-1 text-xs text-muted">
              Choose a quick period or set a custom date range.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                key: 'today' as QuickRange,
                label: 'Today',
              },
              {
                key: 'week' as QuickRange,
                label: 'This Week',
              },
              {
                key: 'month' as QuickRange,
                label: 'This Month',
              },
              {
                key: 'custom' as QuickRange,
                label: 'Custom',
              },
            ].map((item) => {
              const active =
                quickRange ===
                item.key

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    applyQuickRange(
                      item.key
                    )
                  }
                  className={
                    'rounded-xl border px-3 py-3 text-xs font-semibold transition ' +
                    (active
                      ? 'border-court/40 bg-court/10 text-court'
                      : 'border-line bg-paper text-muted hover:border-court/20 hover:text-ink')
                  }
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold text-ink">
                From
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setQuickRange(
                    'custom'
                  )
                  setStartDate(
                    event.target.value
                  )
                }}
                className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink outline-none focus:border-court/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-ink">
                To
              </label>

              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setQuickRange(
                    'custom'
                  )
                  setEndDate(
                    event.target.value
                  )
                }}
                className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink outline-none focus:border-court/40"
              />
            </div>
          </div>
        </section>

        {/* =================================================
            SUMMARY
        ================================================= */}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="pr-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Verified Revenue
            </p>

            <p className="mt-1 font-display text-2xl font-bold text-court">
              {formatCurrency(
                revenue
              )}
            </p>

            <p className="mt-1 text-[10px] text-muted">
              Confirmed + verified payments
            </p>
          </div>

          <div className="pr-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Confirmed
            </p>

            <p className="mt-1 font-display text-2xl font-bold text-blue-400">
              {confirmedCount}
            </p>

            <p className="mt-1 text-[10px] text-muted">
              Active reservations
            </p>
          </div>

          <div className="pr-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Pending Payments
            </p>

            <p className="mt-1 font-display text-2xl font-bold text-yellow-300">
              {pendingPaymentCount}
            </p>

            <p className="mt-1 text-[10px] text-muted">
              Awaiting verification
            </p>
          </div>

          <div className="pr-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Total Bookings
            </p>

            <p className="mt-1 font-display text-2xl font-bold text-ink">
              {filteredRows.length}
            </p>

            <p className="mt-1 text-[10px] text-muted">
              Matching current filters
            </p>
          </div>
        </section>

        {/* =================================================
            SEARCH + FILTERS
        ================================================= */}

        <section className="pr-card mb-6 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Search & Filters
              </p>

              <p className="mt-1 text-xs text-muted">
                Refine the report by court, payment, booking status, or search.
              </p>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex-1 rounded-xl border border-line bg-paper px-3 py-2.5 text-[10px] font-semibold text-muted transition hover:border-court/20 hover:text-court sm:flex-none"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setShowFilters(
                    (current) =>
                      !current
                  )
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-court/30 bg-court/10 px-4 py-2.5 text-[10px] font-bold text-court transition hover:bg-court/15 sm:flex-none"
              >
                <span>☷</span>
                {showFilters
                  ? 'Hide Filters'
                  : 'Filters'}
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={
                  filteredRows.length ===
                  0
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-court px-4 py-2.5 text-[10px] font-bold text-paper transition hover:bg-court-dark disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              >
                ↓ CSV
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-ink">
              Search
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                ⌕
              </span>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search court, payment type, status, or date..."
                className="w-full rounded-xl border border-line bg-paper py-3 pl-9 pr-4 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-court/40"
              />
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-semibold text-ink">
                  Court
                </label>

                <select
                  value={courtFilter}
                  onChange={(event) =>
                    setCourtFilter(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-xs text-ink outline-none focus:border-court/40"
                >
                  <option value="all">
                    All Courts
                  </option>

                  {courtOptions.map(
                    (court) => (
                      <option
                        key={court}
                        value={court}
                      >
                        {court}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-ink">
                  Payment Status
                </label>

                <select
                  value={paymentFilter}
                  onChange={(event) =>
                    setPaymentFilter(
                      event.target.value as PaymentFilter
                    )
                  }
                  className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-xs text-ink outline-none focus:border-court/40"
                >
                  <option value="all">
                    All Payments
                  </option>
                  <option value="pending">
                    Pending ({pendingPaymentCount})
                  </option>
                  <option value="verified">
                    Verified ({verifiedPaymentCount})
                  </option>
                  <option value="rejected">
                    Rejected ({rejectedPaymentCount})
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-ink">
                  Booking Status
                </label>

                <select
                  value={bookingFilter}
                  onChange={(event) =>
                    setBookingFilter(
                      event.target.value as BookingFilter
                    )
                  }
                  className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-xs text-ink outline-none focus:border-court/40"
                >
                  <option value="all">
                    All Bookings
                  </option>
                  <option value="confirmed">
                    Confirmed ({confirmedCount})
                  </option>
                  <option value="cancelled">
                    Cancelled ({cancelledCount})
                  </option>
                </select>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Results
            </span>

            <span className="font-display text-lg font-bold text-court">
              {filteredRows.length}
            </span>
          </div>
        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            <div className="flex items-start gap-3">
              <span>⚠</span>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (
          <div className="pr-card p-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-paper text-court">
              <span className="animate-spin">
                ↻
              </span>
            </div>

            <p className="text-sm font-medium text-ink">
              Loading report...
            </p>

            <p className="mt-1 text-xs text-muted">
              Fetching reservation data.
            </p>
          </div>
        )}

        {/* =================================================
            EMPTY
        ================================================= */}

        {!loading &&
          filteredRows.length ===
            0 && (
            <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-paper text-2xl text-court">
                📊
              </div>

              <h2 className="mt-4 font-display text-lg font-semibold text-ink">
                No matching report data
              </h2>

              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
                There are no reservations matching the selected date range and filters.
              </p>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-xl border border-court/30 bg-court/10 px-4 py-2.5 text-xs font-semibold text-court transition hover:bg-court/15"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

        {/* =================================================
            TABLE
        ================================================= */}

        {!loading &&
          filteredRows.length >
            0 && (
            <section className="pr-card overflow-hidden">
              <div className="border-b border-line px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Reservation Report
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      {formatDate(
                        startDate
                      )}{' '}
                      →{' '}
                      {formatDate(
                        endDate
                      )}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-muted">
                      Total Amount
                    </p>

                    <p className="font-display text-lg font-bold text-court">
                      {formatCurrency(
                        totalAmount
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-paper text-muted">
                    <tr className="border-b border-line">
                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em]">
                        Date
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em]">
                        Time
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em]">
                        Court
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em]">
                        Type
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em]">
                        Amount
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em]">
                        Payment
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.12em]">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map(
                      (row) => (
                        <tr
                          key={row.id}
                          className="border-b border-line last:border-b-0 hover:bg-paper/40"
                        >
                          <td className="px-4 py-3 text-ink">
                            {formatDate(
                              row.date
                            )}
                          </td>

                          <td className="px-4 py-3 text-blue-400">
                            {row.start_time.slice(
                              0,
                              5
                            )}
                            –
                            {row.end_time.slice(
                              0,
                              5
                            )}
                          </td>

                          <td className="px-4 py-3 font-semibold text-ink">
                            {row.court_name}
                          </td>

                          <td className="px-4 py-3 capitalize text-muted">
                            {row.payment_type}
                          </td>

                          <td className="px-4 py-3 font-semibold text-ink">
                            {row.amount_due !=
                            null
                              ? formatCurrency(
                                  Number(
                                    row.amount_due
                                  )
                                )
                              : '—'}
                          </td>

                          <td className="px-4 py-3">
                            {paymentBadge(
                              row.payment_status
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {bookingBadge(
                              row.status
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-line bg-paper/40 px-4 py-3 sm:px-5">
                <p className="text-center text-[10px] text-muted">
                  Showing{' '}
                  {filteredRows.length}{' '}
                  {filteredRows.length ===
                  1
                    ? 'reservation'
                    : 'reservations'}
                </p>
              </div>
            </section>
          )}
      </div>
    </main>
  )
}