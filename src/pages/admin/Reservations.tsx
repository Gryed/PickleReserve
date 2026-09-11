import { useEffect, useMemo, useState } from 'react'
import {
  adminRescheduleBooking,
  cancelBooking,
  getAllReservationsAdmin,
  getAvailableSlots,
  rejectBookingPayment,
  verifyBookingPayment,
} from '../../services/availabilityService'
import { getCourts } from '../../services/courtService'
import type { Court } from '../../types/court'
import type { TimeSlot } from '../../types/availability'

type ReservationRow = {
  id: string
  court_id: string
  user_id: string | null
  guest_name: string | null
  guest_phone: string | null
  date: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled'
  payment_type: 'full' | 'deposit'
  amount_due: number | null
  payment_status: 'pending' | 'verified' | 'rejected'
  payment_proof_url: string | null
  booking_reference: string | null
  created_at: string
  courts: {
    name: string
  } | null
}

type BookingGroup = {
  key: string
  booking_reference: string | null
  rows: ReservationRow[]
  firstRow: ReservationRow
  start_time: string
  end_time: string
  totalAmount: number
  slotCount: number
  payment_status: 'pending' | 'verified' | 'rejected'
  status: 'confirmed' | 'cancelled'
}

type Filter = 'all' | 'confirmed' | 'cancelled'

type ActionType = 'verify' | 'reject' | 'cancel'

type ActionTarget = {
  booking: BookingGroup
  action: ActionType
}

/* =========================================================
   FORMAT HELPERS
========================================================= */

function formatTime(time: string) {
  if (!time) return ''

  const [hourString, minuteString] =
    time.split(':')

  const hour = Number(hourString)
  const minute = minuteString ?? '00'

  if (hour === 24) {
    return `12:${minute} AM (next day)`
  }

  const normalizedHour = hour % 24
  const suffix =
    normalizedHour >= 12 ? 'PM' : 'AM'

  const displayHour =
    normalizedHour % 12 || 12

  return `${displayHour}:${minute} ${suffix}`
}

function formatDate(date: string) {
  if (!date) return ''

  const parsed =
    new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString(
    'en-US',
    {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }
  )
}

function formatCurrency(amount: number) {
  return `₱${amount.toLocaleString(
    'en-PH',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`
}

/* =========================================================
   BOOKING HELPERS
========================================================= */

function getCustomerName(
  row: ReservationRow
) {
  return (
    row.guest_name ||
    'Registered customer'
  )
}

function getGroupPaymentStatus(
  rows: ReservationRow[]
): BookingGroup['payment_status'] {
  if (
    rows.some(
      (row) =>
        row.payment_status ===
        'rejected'
    )
  ) {
    return 'rejected'
  }

  if (
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.payment_status ===
        'verified'
    )
  ) {
    return 'verified'
  }

  return 'pending'
}

function getGroupStatus(
  rows: ReservationRow[]
): BookingGroup['status'] {
  return rows.every(
    (row) =>
      row.status === 'cancelled'
  )
    ? 'cancelled'
    : 'confirmed'
}

function groupReservations(
  rows: ReservationRow[]
): BookingGroup[] {
  const groups = new Map<
    string,
    ReservationRow[]
  >()

  for (const row of rows) {
    const key =
      row.booking_reference ||
      `reservation-${row.id}`

    const existing =
      groups.get(key)

    if (existing) {
      existing.push(row)
    } else {
      groups.set(key, [row])
    }
  }

  return Array.from(
    groups.entries()
  ).map(
    ([key, groupRows]) => {
      const sortedRows =
        [...groupRows].sort(
          (a, b) =>
            a.start_time.localeCompare(
              b.start_time
            )
        )

      const firstRow =
        sortedRows[0]

      const totalAmount =
        sortedRows.reduce(
          (total, row) =>
            total +
            Number(
              row.amount_due ?? 0
            ),
          0
        )

      return {
        key,
        booking_reference:
          firstRow.booking_reference,
        rows: sortedRows,
        firstRow,
        start_time:
          sortedRows[0].start_time,
        end_time:
          sortedRows[
            sortedRows.length - 1
          ].end_time,
        totalAmount,
        slotCount:
          sortedRows.length,
        payment_status:
          getGroupPaymentStatus(
            sortedRows
          ),
        status:
          getGroupStatus(
            sortedRows
          ),
      }
    }
  )
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Reservations() {
  const [rows, setRows] =
    useState<ReservationRow[]>([])

  const [loading, setLoading] =
    useState(true)

  const [actionLoading, setActionLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [filter, setFilter] =
    useState<Filter>('all')

  const [selectedImage, setSelectedImage] =
    useState<string | null>(null)

  const [actionTarget, setActionTarget] =
    useState<ActionTarget | null>(null)

  /* =======================================================
     RESCHEDULE STATE
  ======================================================= */

  const [rescheduleBooking, setRescheduleBooking] =
    useState<BookingGroup | null>(null)

  const [rescheduleDate, setRescheduleDate] =
    useState('')

  const [rescheduleCourtId, setRescheduleCourtId] =
    useState('')

  const [rescheduleSlots, setRescheduleSlots] =
    useState<TimeSlot[]>([])

  const [selectedRescheduleSlots, setSelectedRescheduleSlots] =
    useState<TimeSlot[]>([])

  const [courts, setCourts] =
    useState<Court[]>([])

  const [rescheduleLoading, setRescheduleLoading] =
    useState(false)

  const [rescheduleSaving, setRescheduleSaving] =
    useState(false)

  /* =======================================================
     LOAD RESERVATIONS
  ======================================================= */

  async function load() {
    try {
      setLoading(true)
      setError('')

      const data =
        await getAllReservationsAdmin()

      setRows(
        data as ReservationRow[]
      )
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load reservations.'
      )
    } finally {
      setLoading(false)
    }
  }

  /* =======================================================
     LOAD COURTS
  ======================================================= */

  async function loadCourts() {
    try {
      const data =
        await getCourts()

      setCourts(
        data.filter(
          (court) =>
            court.status ===
            'available'
        )
      )
    } catch (err) {
      console.error(
        'Failed to load courts:',
        err
      )
    }
  }

  useEffect(() => {
    load()
    loadCourts()
  }, [])

  /* =======================================================
     GROUP BOOKINGS
  ======================================================= */

  const bookings = useMemo(
    () =>
      groupReservations(rows),
    [rows]
  )

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredBookings =
    useMemo(() => {
      if (filter === 'all') {
        return bookings
      }

      return bookings.filter(
        (booking) =>
          booking.status ===
          filter
      )
    }, [bookings, filter])

  /* =======================================================
     ACTION HANDLER
  ======================================================= */

  async function handleAction() {
    if (!actionTarget) return

    const {
      booking,
      action,
    } = actionTarget

    try {
      setActionLoading(true)
      setError('')

      if (action === 'verify') {
        await verifyBookingPayment(
          booking.booking_reference
        )
      }

      if (action === 'reject') {
        await rejectBookingPayment(
          booking.booking_reference
        )
      }

      if (action === 'cancel') {
        await cancelBooking(
          booking.booking_reference,
          booking.firstRow.id
        )
      }

      setActionTarget(null)

      await load()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update booking.'
      )
    } finally {
      setActionLoading(false)
    }
  }

  /* =======================================================
     OPEN RESCHEDULE
  ======================================================= */

  function openReschedule(
    booking: BookingGroup
  ) {
    if (
      booking.status !==
        'confirmed' ||
      booking.payment_status !==
        'verified'
    ) {
      return
    }

    setError('')

    setRescheduleBooking(
      booking
    )

    setRescheduleDate(
      booking.firstRow.date
    )

    setRescheduleCourtId(
      booking.firstRow.court_id
    )

    setRescheduleSlots([])

    setSelectedRescheduleSlots(
      []
    )

    loadRescheduleSlots(
      booking.firstRow.court_id,
      booking.firstRow.date
    )
  }

  /* =======================================================
     LOAD RESCHEDULE SLOTS
  ======================================================= */

  async function loadRescheduleSlots(
    courtId: string,
    date: string
  ) {
    if (!courtId || !date) {
      setRescheduleSlots([])
      setSelectedRescheduleSlots(
        []
      )
      return
    }

    try {
      setRescheduleLoading(true)
      setError('')

      const slots =
        await getAvailableSlots(
          courtId,
          date
        )

      setRescheduleSlots(
        slots
      )

      setSelectedRescheduleSlots(
        []
      )
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load available slots.'
      )

      setRescheduleSlots([])
    } finally {
      setRescheduleLoading(false)
    }
  }

  /* =======================================================
     TOGGLE RESCHEDULE SLOT
  ======================================================= */

  function toggleRescheduleSlot(
    slot: TimeSlot
  ) {
    if (!slot.available) {
      return
    }

    setSelectedRescheduleSlots(
      (current) => {
        const exists =
          current.some(
            (item) =>
              item.start_time ===
                slot.start_time &&
              item.end_time ===
                slot.end_time
          )

        if (exists) {
          return current.filter(
            (item) =>
              item.start_time !==
                slot.start_time ||
              item.end_time !==
                slot.end_time
          )
        }

        if (
          rescheduleBooking &&
          current.length >=
            rescheduleBooking.slotCount
        ) {
          return current
        }

        return [
          ...current,
          slot,
        ].sort((a, b) =>
          a.start_time.localeCompare(
            b.start_time
          )
        )
      }
    )
  }

  /* =======================================================
     HANDLE RESCHEDULE
  ======================================================= */

  async function handleReschedule() {
    if (!rescheduleBooking) {
      return
    }

    if (
      !rescheduleBooking
        .booking_reference
    ) {
      setError(
        'Booking reference is missing.'
      )

      return
    }

    if (
      selectedRescheduleSlots.length !==
      rescheduleBooking.slotCount
    ) {
      setError(
        `Please select exactly ${
          rescheduleBooking.slotCount
        } time slot${
          rescheduleBooking.slotCount >
          1
            ? 's'
            : ''
        }.`
      )

      return
    }

    try {
      setRescheduleSaving(true)
      setError('')

      const newSlots =
        selectedRescheduleSlots.map(
          (slot) => ({
            court_id:
              rescheduleCourtId,
            date:
              rescheduleDate,
            start_time:
              slot.start_time,
            end_time:
              slot.end_time,
          })
        )

      await adminRescheduleBooking(
        rescheduleBooking.booking_reference,
        newSlots
      )

      setRescheduleBooking(
        null
      )

      setRescheduleDate('')
      setRescheduleCourtId('')
      setRescheduleSlots([])
      setSelectedRescheduleSlots(
        []
      )

      await load()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to reschedule booking.'
      )
    } finally {
      setRescheduleSaving(false)
    }
  }

  /* =======================================================
     ACTION TEXT
  ======================================================= */

  function getActionTitle(
    action: ActionType
  ) {
    if (action === 'verify') {
      return 'Verify Payment'
    }

    if (action === 'reject') {
      return 'Reject Payment'
    }

    return 'Cancel Booking'
  }

  function getActionDescription(
    action: ActionType
  ) {
    if (action === 'verify') {
      return 'This will mark the entire booking as paid and verified.'
    }

    if (action === 'reject') {
      return 'This will reject the payment and cancel the entire booking so the reserved slots become available again.'
    }

    return 'This will cancel the entire booking and release all reserved slots.'
  }

  /* =======================================================
     PAYMENT BADGE
  ======================================================= */

  function getPaymentBadge(
    status: BookingGroup['payment_status']
  ) {
    if (status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-400/20 bg-green-400/10 px-2.5 py-1 text-[10px] font-semibold text-green-400">
          <span className="text-[9px]">
            ✓
          </span>
          Verified
        </span>
      )
    }

    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[10px] font-semibold text-red-400">
          <span className="text-[9px]">
            ✕
          </span>
          Rejected
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1 text-[10px] font-semibold text-yellow-300">
        <span className="text-[9px]">
          ⏳
        </span>
        Pending
      </span>
    )
  }

  /* =======================================================
     STATUS BADGE
  ======================================================= */

  function getStatusBadge(
    status: BookingGroup['status']
  ) {
    if (status === 'cancelled') {
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

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="pr-page">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <section className="mb-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span>
                  Admin
                </span>

                <span className="text-line">
                  /
                </span>

                <span className="text-court">
                  Reservations
                </span>
              </div>

              <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Reservations
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                Manage and monitor customer court
                reservations.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
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
            SUMMARY
        ================================================= */}

        {!loading && (
          <section className="mb-6 grid gap-3 sm:grid-cols-3 sm:gap-4">

            <div className="pr-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Total
              </p>

              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="font-display text-2xl font-bold text-ink">
                  {bookings.length}
                </p>

                <span className="text-xs text-muted">
                  bookings
                </span>
              </div>
            </div>

            <div className="pr-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Confirmed
              </p>

              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="font-display text-2xl font-bold text-blue-400">
                  {
                    bookings.filter(
                      (booking) =>
                        booking.status ===
                        'confirmed'
                    ).length
                  }
                </p>

                <span className="text-xs text-muted">
                  active
                </span>
              </div>
            </div>

            <div className="pr-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Cancelled
              </p>

              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="font-display text-2xl font-bold text-muted">
                  {
                    bookings.filter(
                      (booking) =>
                        booking.status ===
                        'cancelled'
                    ).length
                  }
                </p>

                <span className="text-xs text-muted">
                  inactive
                </span>
              </div>
            </div>

          </section>
        )}

        {/* =================================================
            FILTERS
        ================================================= */}

        <section className="mb-6">
          <div className="flex flex-wrap items-center gap-2">

            {[
              {
                value:
                  'all' as Filter,
                label: 'All',
              },
              {
                value:
                  'confirmed' as Filter,
                label: 'Confirmed',
              },
              {
                value:
                  'cancelled' as Filter,
                label: 'Cancelled',
              },
            ].map((item) => {
              const isActive =
                filter ===
                item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setFilter(
                      item.value
                    )
                  }
                  className={
                    'rounded-xl border px-4 py-2.5 text-xs font-semibold transition ' +
                    (isActive
                      ? 'border-court/30 bg-court/10 text-court'
                      : 'border-line bg-surface text-muted hover:border-court/20 hover:text-ink')
                  }
                >
                  {item.label}

                  <span
                    className={
                      'ml-2 rounded-full px-1.5 py-0.5 text-[9px] ' +
                      (isActive
                        ? 'bg-court/10 text-court'
                        : 'bg-paper text-muted')
                    }
                  >
                    {item.value ===
                    'all'
                      ? bookings.length
                      : bookings.filter(
                          (booking) =>
                            booking.status ===
                            item.value
                        ).length}
                  </span>
                </button>
              )
            })}

          </div>
        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            <div className="flex items-start gap-3">
              <span className="mt-0.5">
                ⚠
              </span>

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
              Loading reservations...
            </p>

            <p className="mt-1 text-xs text-muted">
              Please wait while we fetch the
              latest bookings.
            </p>
          </div>
        )}

        {/* =================================================
            EMPTY
        ================================================= */}

        {!loading &&
          filteredBookings.length ===
            0 && (
            <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-paper text-2xl text-court">
                📅
              </div>

              <h2 className="mt-4 font-display text-lg font-semibold text-ink">
                No reservations found
              </h2>

              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
                There are no bookings matching
                the selected filter.
              </p>

            </div>
          )}

        {/* =================================================
            BOOKINGS
        ================================================= */}

        {!loading &&
          filteredBookings.length >
            0 && (
            <div className="space-y-4">

              {filteredBookings.map(
                (booking) => {
                  const firstRow =
                    booking.firstRow

                  const paymentProof =
                    booking.rows.find(
                      (row) =>
                        row.payment_proof_url
                    )
                      ?.payment_proof_url ??
                    null

                  return (
                    <article
                      key={booking.key}
                      className="pr-card overflow-hidden transition duration-200 hover:border-court/20"
                    >

                      {/* =================================
                          TOP
                      ================================= */}

                      <div className="border-b border-line px-4 py-4 sm:px-5">

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="font-display text-sm font-bold text-ink sm:text-base">
                                {booking.booking_reference ||
                                  'No booking reference'}
                              </span>

                              {getStatusBadge(
                                booking.status
                              )}

                              {getPaymentBadge(
                                booking.payment_status
                              )}

                            </div>

                            <p className="mt-2 text-[11px] text-muted">
                              Created{' '}
                              {new Date(
                                firstRow.created_at
                              ).toLocaleString()}
                            </p>

                          </div>

                          <div className="rounded-xl border border-line bg-paper px-4 py-3 lg:min-w-[150px] lg:text-right">

                            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                              Total
                            </div>

                            <div className="mt-0.5 font-display text-xl font-bold text-court">
                              {formatCurrency(
                                booking.totalAmount
                              )}
                            </div>

                            <div className="mt-0.5 text-[10px] text-muted">
                              {booking.slotCount}{' '}
                              {booking.slotCount ===
                              1
                                ? 'hour'
                                : 'hours'}
                            </div>

                          </div>

                        </div>

                      </div>

                      {/* =================================
                          DETAILS
                      ================================= */}

                      <div className="grid gap-4 px-4 py-5 sm:px-5 md:grid-cols-2 xl:grid-cols-4">

                        {/* CUSTOMER */}

                        <div className="min-w-0">

                          <div className="mb-2 flex items-center gap-2">

                            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-paper text-xs text-court">
                              ◉
                            </div>

                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                              Customer
                            </span>

                          </div>

                          <div className="font-semibold text-ink">
                            {getCustomerName(
                              firstRow
                            )}
                          </div>

                          {firstRow.guest_phone && (
                            <div className="mt-1 text-xs text-muted">
                              {firstRow.guest_phone}
                            </div>
                          )}

                          {firstRow.user_id && (
                            <div className="mt-1 inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-[9px] font-semibold text-blue-400">
                              Registered account
                            </div>
                          )}

                        </div>

                        {/* COURT */}

                        <div className="min-w-0">

                          <div className="mb-2 flex items-center gap-2">

                            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-paper text-xs text-court">
                              🏓
                            </div>

                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                              Court
                            </span>

                          </div>

                          <div className="font-semibold text-ink">
                            {firstRow.courts?.name ||
                              'Unknown court'}
                          </div>

                        </div>

                        {/* DATE / TIME */}

                        <div className="min-w-0">

                          <div className="mb-2 flex items-center gap-2">

                            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-paper text-xs text-blue-400">
                              ◷
                            </div>

                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                              Schedule
                            </span>

                          </div>

                          <div className="font-semibold text-ink">
                            {formatDate(
                              firstRow.date
                            )}
                          </div>

                          <div className="mt-1 text-xs text-blue-400">
                            {formatTime(
                              booking.start_time
                            )}{' '}
                            –{' '}
                            {formatTime(
                              booking.end_time
                            )}
                          </div>

                        </div>

                        {/* PAYMENT */}

                        <div className="min-w-0">

                          <div className="mb-2 flex items-center gap-2">

                            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-paper text-xs text-court">
                              ₱
                            </div>

                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                              Payment
                            </span>

                          </div>

                          <div className="font-semibold capitalize text-ink">
                            {firstRow.payment_type}
                          </div>

                          <div className="mt-1 text-xs text-muted">
                            {booking.payment_status ===
                            'verified'
                              ? 'Payment verified'
                              : booking.payment_status ===
                                'rejected'
                              ? 'Payment rejected'
                              : 'Pending payment verification'}
                          </div>

                        </div>

                      </div>

                      {/* =================================
                          ACTIONS
                      ================================= */}

                      <div className="flex flex-col gap-2 border-t border-line bg-paper/60 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">

                        {/* VIEW PROOF */}

                        {paymentProof && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedImage(
                                paymentProof
                              )
                            }
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-muted transition hover:border-blue-400/30 hover:text-blue-400 sm:w-auto"
                          >
                            <span>
                              👁
                            </span>

                            View Payment Proof
                          </button>
                        )}

                        {/* VERIFY / REJECT */}

                        {booking.status ===
                          'confirmed' &&
                          booking.payment_status ===
                            'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setActionTarget({
                                    booking,
                                    action:
                                      'verify',
                                  })
                                }
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-court px-4 py-2.5 text-xs font-bold text-paper transition hover:-translate-y-0.5 hover:bg-court-dark sm:w-auto"
                              >
                                <span>
                                  ✓
                                </span>

                                Verify Payment
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setActionTarget({
                                    booking,
                                    action:
                                      'reject',
                                  })
                                }
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2.5 text-xs font-semibold text-red-400 transition hover:border-red-400/40 hover:bg-red-400/15 sm:w-auto"
                              >
                                <span>
                                  ✕
                                </span>

                                Reject Payment
                              </button>
                            </>
                          )}

                        {/* RESCHEDULE */}

                        {booking.status ===
                          'confirmed' &&
                          booking.payment_status ===
                            'verified' && (
                            <button
                              type="button"
                              onClick={() =>
                                openReschedule(
                                  booking
                                )
                              }
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-court/30 bg-court/10 px-4 py-2.5 text-xs font-semibold text-court transition hover:bg-court/15 sm:w-auto"
                            >
                              <span>
                                ↻
                              </span>

                              Reschedule
                            </button>
                          )}

                        {/* CANCEL */}

                        {booking.status ===
                          'confirmed' && (
                          <button
                            type="button"
                            onClick={() =>
                              setActionTarget({
                                booking,
                                action:
                                  'cancel',
                              })
                            }
                            className="inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-medium text-muted transition hover:border-red-400/30 hover:text-red-400 sm:w-auto"
                          >
                            Cancel Booking
                          </button>
                        )}

                        {/* CANCELLED */}

                        {booking.status ===
                          'cancelled' && (
                          <span className="flex items-center gap-2 text-xs text-muted">

                            <span className="h-1.5 w-1.5 rounded-full bg-muted" />

                            This booking has been
                            cancelled.

                          </span>
                        )}

                      </div>

                    </article>
                  )
                }
              )}

            </div>
          )}

        {/* =================================================
            FOOTER NOTE
        ================================================= */}

        {!loading &&
          filteredBookings.length >
            0 && (
            <footer className="py-6 text-center">
              <p className="text-[10px] text-muted">
                Showing{' '}
                {filteredBookings.length}{' '}
                {filteredBookings.length ===
                1
                  ? 'booking'
                  : 'bookings'}
              </p>
            </footer>
          )}

      </div>

      {/* ===================================================
          PAYMENT PROOF MODAL
      =================================================== */}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() =>
            setSelectedImage(null)
          }
        >

          <div
            className="relative max-h-[90vh] max-w-4xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <button
              type="button"
              onClick={() =>
                setSelectedImage(null)
              }
              aria-label="Close payment proof"
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/70 text-lg text-white transition hover:bg-black"
            >
              ✕
            </button>

            <img
              src={selectedImage}
              alt="Payment proof"
              className="max-h-[85vh] max-w-full rounded-2xl border border-line object-contain shadow-2xl"
            />

          </div>

        </div>
      )}

      {/* ===================================================
          ACTION CONFIRMATION MODAL
      =================================================== */}

      {actionTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">

          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">

            {/* MODAL HEADER */}

            <div className="border-b border-line px-5 py-5 sm:px-6">

              <div className="flex items-start gap-3">

                <div
                  className={
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm ' +
                    (actionTarget.action ===
                    'verify'
                      ? 'border border-court/20 bg-court/10 text-court'
                      : 'border border-red-400/20 bg-red-400/10 text-red-400')
                  }
                >
                  {actionTarget.action ===
                  'verify'
                    ? '✓'
                    : '!'}
                </div>

                <div>

                  <h2 className="font-display text-lg font-bold text-ink">
                    {getActionTitle(
                      actionTarget.action
                    )}
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-muted">
                    {getActionDescription(
                      actionTarget.action
                    )}
                  </p>

                </div>

              </div>

            </div>

            {/* BOOKING SUMMARY */}

            <div className="px-5 py-5 sm:px-6">

              <div className="rounded-xl border border-line bg-paper p-4">

                <div className="mb-3 flex items-center justify-between gap-3">

                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Booking
                  </span>

                  {getStatusBadge(
                    actionTarget.booking.status
                  )}

                </div>

                <div className="font-display text-sm font-bold text-ink">
                  {actionTarget.booking
                    .booking_reference ||
                    'No reference'}
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-muted">

                  <div>
                    {getCustomerName(
                      actionTarget.booking
                        .firstRow
                    )}
                  </div>

                  <div>
                    {actionTarget.booking
                      .firstRow.courts
                      ?.name ||
                      'Unknown court'}
                  </div>

                  <div>
                    {formatDate(
                      actionTarget.booking
                        .firstRow.date
                    )}
                  </div>

                  <div className="text-blue-400">
                    {formatTime(
                      actionTarget.booking
                        .start_time
                    )}{' '}
                    –{' '}
                    {formatTime(
                      actionTarget.booking
                        .end_time
                    )}
                  </div>

                </div>

                <div className="mt-4 border-t border-line pt-3">

                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Total Amount
                  </div>

                  <div className="mt-0.5 font-display text-lg font-bold text-court">
                    {formatCurrency(
                      actionTarget.booking
                        .totalAmount
                    )}
                  </div>

                </div>

              </div>

            </div>

            {/* MODAL ACTIONS */}

            <div className="flex flex-col-reverse gap-2 border-t border-line bg-paper/50 p-4 sm:flex-row sm:justify-end">

              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  setActionTarget(null)
                }
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-muted transition hover:border-court/20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Keep Booking
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleAction}
                className={
                  'w-full rounded-xl px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ' +
                  (actionTarget.action ===
                  'verify'
                    ? 'bg-court text-paper hover:bg-court-dark'
                    : 'bg-red-500 text-white hover:bg-red-600')
                }
              >
                {actionLoading
                  ? 'Processing...'
                  : getActionTitle(
                      actionTarget.action
                    )}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================
          RESCHEDULE MODAL
      =================================================== */}

      {rescheduleBooking && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!rescheduleSaving) {
              setRescheduleBooking(
                null
              )
            }
          }}
        >

          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="border-b border-line px-5 py-5 sm:px-6">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-court">
                    Admin
                  </p>

                  <h2 className="mt-1 font-display text-xl font-bold text-ink">
                    Reschedule Booking
                  </h2>

                  <p className="mt-1 text-xs text-muted">
                    {rescheduleBooking.booking_reference}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={rescheduleSaving}
                  onClick={() =>
                    setRescheduleBooking(
                      null
                    )
                  }
                  className="rounded-lg px-2 py-1 text-muted transition hover:bg-paper hover:text-ink disabled:opacity-50"
                >
                  ✕
                </button>

              </div>

            </div>

            {/* CURRENT BOOKING */}

            <div className="border-b border-line bg-paper/50 px-5 py-4 sm:px-6">

              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Current Schedule
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">

                <div>
                  <p className="text-[10px] text-muted">
                    Date
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    {formatDate(
                      rescheduleBooking
                        .firstRow
                        .date
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-muted">
                    Court
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    {rescheduleBooking
                      .firstRow
                      .courts
                      ?.name ||
                      'Court'}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-muted">
                    Slots
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    {rescheduleBooking.slotCount}
                  </p>
                </div>

              </div>

              <div className="mt-3 flex flex-wrap gap-2">

                {rescheduleBooking.rows.map(
                  (row) => (
                    <span
                      key={row.id}
                      className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] text-muted"
                    >
                      {formatTime(
                        row.start_time
                      )}{' '}
                      –{' '}
                      {formatTime(
                        row.end_time
                      )}
                    </span>
                  )
                )}

              </div>

            </div>

            {/* BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">

              <div className="space-y-5">

                {/* DATE */}

                <div>
                  <label
                    htmlFor="reschedule-date"
                    className="mb-2 block text-xs font-semibold text-ink"
                  >
                    New Date
                  </label>

                  <input
                    id="reschedule-date"
                    type="date"
                    value={
                      rescheduleDate
                    }
                    onChange={(
                      event
                    ) => {
                      const value =
                        event.target
                          .value

                      setRescheduleDate(
                        value
                      )

                      if (
                        value &&
                        rescheduleCourtId
                      ) {
                        loadRescheduleSlots(
                          rescheduleCourtId,
                          value
                        )
                      }
                    }}
                    className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink outline-none focus:border-court/40"
                  />
                </div>

                {/* COURT */}

                <div>
                  <label
                    htmlFor="reschedule-court"
                    className="mb-2 block text-xs font-semibold text-ink"
                  >
                    New Court
                  </label>

                  <select
                    id="reschedule-court"
                    value={
                      rescheduleCourtId
                    }
                    onChange={(
                      event
                    ) => {
                      const value =
                        event.target
                          .value

                      setRescheduleCourtId(
                        value
                      )

                      if (
                        value &&
                        rescheduleDate
                      ) {
                        loadRescheduleSlots(
                          value,
                          rescheduleDate
                        )
                      }
                    }}
                    className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink outline-none focus:border-court/40"
                  >
                    <option value="">
                      Select court
                    </option>

                    {courts.map(
                      (court) => (
                        <option
                          key={
                            court.id
                          }
                          value={
                            court.id
                          }
                        >
                          {court.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* SLOT INFO */}

                <div className="rounded-xl border border-court/20 bg-court/5 px-4 py-3">

                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                    <p className="text-xs font-semibold text-court">
                      Select{' '}
                      {
                        rescheduleBooking.slotCount
                      }{' '}
                      slot
                      {rescheduleBooking.slotCount >
                      1
                        ? 's'
                        : ''}
                    </p>

                    <span className="text-[10px] text-muted">
                      {
                        selectedRescheduleSlots.length
                      }
                      /
                      {
                        rescheduleBooking.slotCount
                      }{' '}
                      selected
                    </span>

                  </div>

                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    The number of slots must remain the same as the original booking.
                  </p>

                </div>

                {/* SLOTS */}

                <div>

                  <div className="mb-2 flex items-center justify-between gap-3">

                    <label className="text-xs font-semibold text-ink">
                      Available Time Slots
                    </label>

                    {!rescheduleLoading &&
                      rescheduleSlots.length >
                        0 && (
                        <span className="text-[10px] text-muted">
                          {
                            rescheduleSlots.filter(
                              (
                                slot
                              ) =>
                                slot.available
                            ).length
                          }{' '}
                          available
                        </span>
                      )}

                  </div>

                  {rescheduleLoading ? (
                    <div className="rounded-xl border border-line bg-paper px-4 py-10 text-center text-xs text-muted">
                      <span className="mr-2 inline-block animate-spin">
                        ↻
                      </span>
                      Loading available slots...
                    </div>
                  ) : rescheduleSlots.length ===
                    0 ? (
                    <div className="rounded-xl border border-line bg-paper px-4 py-10 text-center">

                      <div className="text-xl">
                        🕐
                      </div>

                      <p className="mt-2 text-xs font-medium text-ink">
                        No slots available
                      </p>

                      <p className="mt-1 text-[10px] text-muted">
                        Select another date or court.
                      </p>

                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">

                      {rescheduleSlots.map(
                        (slot) => {
                          const selected =
                            selectedRescheduleSlots.some(
                              (item) =>
                                item.start_time ===
                                  slot.start_time &&
                                item.end_time ===
                                  slot.end_time
                            )

                          const disabledByLimit =
                            !selected &&
                            selectedRescheduleSlots.length >=
                              rescheduleBooking.slotCount

                          return (
                            <button
                              key={`${slot.start_time}-${slot.end_time}`}
                              type="button"
                              disabled={
                                !slot.available ||
                                disabledByLimit
                              }
                              onClick={() =>
                                toggleRescheduleSlot(
                                  slot
                                )
                              }
                              className={
                                'rounded-xl border px-3 py-3 text-left transition ' +
                                (
                                  selected
                                    ? 'border-court bg-court/10 text-court'
                                    : slot.available &&
                                        !disabledByLimit
                                      ? 'border-line bg-paper text-ink hover:border-court/30 hover:bg-court/5'
                                      : 'cursor-not-allowed border-line bg-paper opacity-40'
                                )
                              }
                            >

                              <div className="flex items-center justify-between gap-2">

                                <p className="text-xs font-semibold">
                                  {formatTime(
                                    slot.start_time
                                  )}
                                </p>

                                {selected && (
                                  <span className="text-[10px]">
                                    ✓
                                  </span>
                                )}

                              </div>

                              <p className="mt-0.5 text-[10px] opacity-70">
                                {formatTime(
                                  slot.end_time
                                )}
                              </p>

                              {!slot.available && (
                                <p className="mt-1 text-[9px] font-semibold uppercase">
                                  {slot.status ===
                                  'pending'
                                    ? 'Pending'
                                    : 'Booked'}
                                </p>
                              )}

                              {selected && (
                                <p className="mt-1 text-[9px] font-semibold uppercase">
                                  Selected
                                </p>
                              )}

                            </button>
                          )
                        }
                      )}

                    </div>
                  )}

                </div>

                {/* WARNING */}

                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">

                  <div className="flex items-start gap-2">

                    <span className="mt-0.5 text-yellow-300">
                      ⚠
                    </span>

                    <div>
                      <p className="text-xs font-semibold text-yellow-200">
                        Admin Reschedule
                      </p>

                      <p className="mt-1 text-[10px] leading-5 text-muted">
                        This will immediately move the booking. The booking reference and verified payment will remain unchanged.
                      </p>
                    </div>

                  </div>

                </div>

              </div>

            </div>

            {/* FOOTER */}

            <div className="flex flex-col-reverse gap-2 border-t border-line bg-paper/50 p-4 sm:flex-row sm:justify-end sm:px-6">

              <button
                type="button"
                disabled={
                  rescheduleSaving
                }
                onClick={() =>
                  setRescheduleBooking(
                    null
                  )
                }
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-muted transition hover:border-court/20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Close
              </button>

              <button
                type="button"
                disabled={
                  rescheduleSaving ||
                  selectedRescheduleSlots.length !==
                    rescheduleBooking.slotCount
                }
                onClick={
                  handleReschedule
                }
                className="w-full rounded-xl bg-court px-4 py-2.5 text-xs font-bold text-paper transition hover:bg-court-dark disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {rescheduleSaving
                  ? 'Rescheduling...'
                  : 'Confirm Reschedule'}
              </button>

            </div>

          </div>

        </div>
      )}

    </main>
  )
}