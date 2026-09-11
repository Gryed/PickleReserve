
import { useEffect, useMemo, useState } from 'react'
import {
  getPendingPaymentsAdmin,
  rejectBookingPayment,
  verifyBookingPayment,
} from '../../services/availabilityService'

type PendingReservation = {
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
  rows: PendingReservation[]
  firstRow: PendingReservation
  start_time: string
  end_time: string
  totalAmount: number
  slotCount: number
}

type ActionType = 'verify' | 'reject'

type ActionTarget = {
  booking: BookingGroup
  action: ActionType
}

/* =========================================================
   FORMAT HELPERS
========================================================= */

function formatTime(time: string) {
  if (!time) return ''

  const [hourString, minuteString] = time.split(':')
  const hour = Number(hourString)
  const minute = minuteString ?? '00'

  if (hour === 24) {
    return `12:${minute} AM (next day)`
  }

  const normalizedHour = hour % 24
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM'
  const displayHour = normalizedHour % 12 || 12

  return `${displayHour}:${minute} ${suffix}`
}

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

/* =========================================================
   CUSTOMER
========================================================= */

function getCustomerName(row: PendingReservation) {
  return row.guest_name || 'Registered customer'
}

/* =========================================================
   GROUP BOOKINGS
========================================================= */

function groupReservations(
  rows: PendingReservation[]
): BookingGroup[] {
  const groups = new Map<
    string,
    PendingReservation[]
  >()

  for (const row of rows) {
    const key =
      row.booking_reference ||
      `reservation-${row.id}`

    const existing = groups.get(key)

    if (existing) {
      existing.push(row)
    } else {
      groups.set(key, [row])
    }
  }

  return Array.from(groups.entries()).map(
    ([key, groupRows]) => {
      const sortedRows = [...groupRows].sort(
        (a, b) =>
          a.start_time.localeCompare(
            b.start_time
          )
      )

      const firstRow = sortedRows[0]

      const totalAmount =
        sortedRows.reduce(
          (total, row) =>
            total +
            Number(row.amount_due ?? 0),
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
        slotCount: sortedRows.length,
      }
    }
  )
}

/* =========================================================
   COMPONENT
========================================================= */

export default function PendingPayments() {
  const [rows, setRows] =
    useState<PendingReservation[]>([])

  const [loading, setLoading] =
    useState(true)

  const [actionLoading, setActionLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [selectedImage, setSelectedImage] =
    useState<string | null>(null)

  const [actionTarget, setActionTarget] =
    useState<ActionTarget | null>(null)

  /* =======================================================
     LOAD PENDING PAYMENTS
  ======================================================= */

  async function loadPayments() {
    try {
      setLoading(true)
      setError('')

      const data =
        await getPendingPaymentsAdmin()

      setRows(
        data as PendingReservation[]
      )
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load pending payments.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  /* =======================================================
     GROUP
  ======================================================= */

  const bookings = useMemo(
    () =>
      groupReservations(rows),
    [rows]
  )

  /* =======================================================
     ACTION
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

      setActionTarget(null)

      await loadPayments()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update payment.'
      )
    } finally {
      setActionLoading(false)
    }
  }

  /* =======================================================
     ACTION TEXT
  ======================================================= */

  function getActionTitle(
    action: ActionType
  ) {
    return action === 'verify'
      ? 'Verify Payment'
      : 'Reject Payment'
  }

  function getActionDescription(
    action: ActionType
  ) {
    if (action === 'verify') {
      return 'This will mark the entire booking as paid and verified.'
    }

    return 'This will reject the payment, cancel the entire booking, and release all reserved slots.'
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Pending Payments
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Review and verify customer payment submissions.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <div className="text-sm text-gray-500">
            Loading pending payments...
          </div>
        </div>
      </div>
    )
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="space-y-6">
      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Pending Payments
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Review and verify customer payment submissions.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPayments}
          disabled={loading}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          {loading
            ? 'Refreshing...'
            : '↻ Refresh'}
        </button>
      </div>

      {/* ===================================================
          COUNT
      =================================================== */}

      <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
          Awaiting verification
        </div>

        <div className="mt-1 text-2xl font-bold text-yellow-900">
          {bookings.length}
        </div>

        <div className="mt-1 text-sm text-yellow-700">
          {bookings.length === 1
            ? 'booking'
            : 'bookings'}{' '}
          currently waiting for payment review.
        </div>
      </div>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ===================================================
          EMPTY
      =================================================== */}

      {bookings.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="text-4xl">
            ✅
          </div>

          <h2 className="mt-3 text-lg font-semibold text-gray-900">
            No pending payments
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            All submitted payments have already
            been processed.
          </p>

          <button
            type="button"
            onClick={loadPayments}
            className="mt-5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      )}

      {/* ===================================================
          BOOKINGS
      =================================================== */}

      {bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((booking) => {
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
              <div
                key={booking.key}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* =========================================
                    HEADER
                ========================================= */}

                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-gray-900">
                          {booking.booking_reference ||
                            'No booking reference'}
                        </span>

                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                          ⏳ Pending
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-gray-400">
                        Submitted{' '}
                        {new Date(
                          firstRow.created_at
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Total
                      </div>

                      <div className="text-xl font-bold text-gray-900">
                        {formatCurrency(
                          booking.totalAmount
                        )}
                      </div>

                      <div className="text-xs text-gray-500">
                        {booking.slotCount}{' '}
                        {booking.slotCount ===
                        1
                          ? 'hour'
                          : 'hours'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* =========================================
                    DETAILS
                ========================================= */}

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  {/* CUSTOMER */}

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Customer
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {getCustomerName(
                        firstRow
                      )}
                    </div>

                    {firstRow.guest_phone && (
                      <div className="mt-1 text-sm text-gray-500">
                        {firstRow.guest_phone}
                      </div>
                    )}

                    {firstRow.user_id && (
                      <div className="mt-1 text-xs text-blue-600">
                        Registered customer
                      </div>
                    )}

                    {!firstRow.user_id && (
                      <div className="mt-1 text-xs text-orange-600">
                        Guest / Walk-in
                      </div>
                    )}
                  </div>

                  {/* COURT */}

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Court
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {firstRow.courts?.name ||
                        'Unknown court'}
                    </div>
                  </div>

                  {/* SCHEDULE */}

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Schedule
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {formatDate(
                        firstRow.date
                      )}
                    </div>

                    <div className="mt-1 text-sm text-gray-500">
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

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Payment
                    </div>

                    <div className="mt-1 font-semibold capitalize text-gray-900">
                      {firstRow.payment_type ===
                      'deposit'
                        ? 'Deposit'
                        : 'Full payment'}
                    </div>

                    <div className="mt-1 text-sm text-gray-500">
                      Amount due:{' '}
                      {formatCurrency(
                        booking.totalAmount
                      )}
                    </div>
                  </div>
                </div>

                {/* =========================================
                    PAYMENT PROOF
                ========================================= */}

                {paymentProof && (
                  <div className="border-t border-gray-100 px-5 py-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Payment Proof
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedImage(
                            paymentProof
                          )
                        }
                        className="group relative block overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                      >
                        <img
                          src={paymentProof}
                          alt="Payment proof"
                          className="h-48 w-full object-contain transition group-hover:scale-[1.02] sm:h-56 sm:w-80"
                        />

                        <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-left text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                          Click to view full size
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {!paymentProof && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                      ⚠ No payment proof has been uploaded
                      for this booking.
                    </div>
                  </div>
                )}

                {/* =========================================
                    ACTIONS
                ========================================= */}

                <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:flex-wrap">
                  {paymentProof && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedImage(
                          paymentProof
                        )
                      }
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      👁 View Payment Proof
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setActionTarget({
                        booking,
                        action: 'verify',
                      })
                    }
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    ✓ Verify Payment
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActionTarget({
                        booking,
                        action: 'reject',
                      })
                    }
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    ✕ Reject Payment
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===================================================
          PAYMENT PROOF MODAL
      =================================================== */}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
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
              className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-3 py-2 text-white hover:bg-black"
            >
              ✕
            </button>

            <img
              src={selectedImage}
              alt="Payment proof"
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* ===================================================
          ACTION CONFIRMATION MODAL
      =================================================== */}

      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* MODAL CONTENT */}

            <div className="p-6">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  actionTarget.action ===
                  'verify'
                    ? 'bg-green-100'
                    : 'bg-red-100'
                }`}
              >
                <span className="text-xl">
                  {actionTarget.action ===
                  'verify'
                    ? '✓'
                    : '✕'}
                </span>
              </div>

              <h2 className="mt-4 text-lg font-bold text-gray-900">
                {getActionTitle(
                  actionTarget.action
                )}
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                {getActionDescription(
                  actionTarget.action
                )}
              </p>

              {/* BOOKING SUMMARY */}

              <div className="mt-4 rounded-xl bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">
                  Booking
                </div>

                <div className="mt-1 font-semibold text-gray-900">
                  {actionTarget.booking
                    .booking_reference ||
                    'No reference'}
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  {getCustomerName(
                    actionTarget.booking
                      .firstRow
                  )}
                </div>

                <div className="mt-1 text-sm text-gray-600">
                  {actionTarget.booking
                    .firstRow.courts
                    ?.name ||
                    'Unknown court'}
                </div>

                <div className="mt-1 text-sm text-gray-600">
                  {formatDate(
                    actionTarget.booking
                      .firstRow.date
                  )}
                </div>

                <div className="text-sm text-gray-600">
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

                <div className="mt-2 font-semibold text-gray-900">
                  {formatCurrency(
                    actionTarget.booking
                      .totalAmount
                  )}
                </div>
              </div>
            </div>

            {/* MODAL BUTTONS */}

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  setActionTarget(null)
                }
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Payment Pending
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleAction}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  actionTarget.action ===
                  'verify'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
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
    </div>
  )
}
