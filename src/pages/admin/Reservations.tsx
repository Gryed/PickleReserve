import { useEffect, useState } from 'react'
import {
  cancelReservation,
  getAllReservationsAdmin,
} from '../../services/availabilityService'

interface ReservationRow {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  payment_type: string
  amount_due: number | null
  payment_status: string
  payment_proof_url: string | null
  booking_reference: string | null
  user_id: string | null
  guest_name: string | null
  guest_phone: string | null
  courts: { name: string } | null
}

type Filter = 'all' | 'confirmed' | 'cancelled'

export default function Reservations() {
  const [rows, setRows] = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] =
    useState<ReservationRow | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError('')

      const data = await getAllReservationsAdmin()

      setRows(data as unknown as ReservationRow[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load reservations'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return

    setCancellingId(cancelTarget.id)
    setError('')

    try {
      await cancelReservation(cancelTarget.id)

      setCancelTarget(null)

      await load()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to cancel reservation'
      )
    } finally {
      setCancellingId(null)
    }
  }

  const displayedRows =
    filter === 'all'
      ? rows
      : rows.filter((r) => r.status === filter)

  function paymentBadge(status: string) {
    if (status === 'verified') {
      return (
        <span className="rounded-full bg-court/15 px-2 py-1 text-xs text-court">
          Verified
        </span>
      )
    }

    if (status === 'rejected') {
      return (
        <span className="rounded-full bg-red-950/40 px-2 py-1 text-xs text-red-400">
          Rejected
        </span>
      )
    }

    return (
      <span className="rounded-full bg-line px-2 py-1 text-xs text-muted">
        Pending
      </span>
    )
  }

  function statusBadge(status: string) {
    if (status === 'cancelled') {
      return (
        <span className="rounded-full bg-line px-2 py-1 text-xs capitalize text-muted">
          Cancelled
        </span>
      )
    }

    return (
      <span className="rounded-full bg-court/15 px-2 py-1 text-xs capitalize text-court">
        {status}
      </span>
    )
  }

  function getCustomerName(row: ReservationRow) {
    return row.guest_name?.trim() || 'Registered customer'
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6 text-muted sm:p-8">
        Loading reservations...
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-8">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Reservations
            </h1>

            <p className="mt-1 text-sm text-muted">
              Manage customer bookings and payment proofs.
            </p>
          </div>

          {/* FILTERS */}
          <div className="flex flex-wrap gap-2 text-xs">
            {(['all', 'confirmed', 'cancelled'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  'rounded-full border px-3 py-1.5 capitalize transition-colors ' +
                  (filter === f
                    ? 'btn-court border-court'
                    : 'border-line text-muted hover:border-court')
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* EMPTY */}
        {displayedRows.length === 0 && (
          <div className="rounded-lg border border-line p-8 text-center text-muted">
            No reservations found.
          </div>
        )}

        {/* RESERVATION LIST */}
        <div className="space-y-3">
          {displayedRows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-line bg-surface p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* LEFT */}
                <div className="min-w-0 flex-1">
                  {/* BOOKING REFERENCE */}
                  {r.booking_reference && (
                    <p className="mb-2 break-all text-xs font-medium text-court">
                      {r.booking_reference}
                    </p>
                  )}

                  {/* CUSTOMER */}
                  <div className="mb-3">
                    <p className="text-xs text-muted">
                      Customer
                    </p>

                    <p className="font-display text-lg font-semibold text-ink">
                      {getCustomerName(r)}
                    </p>

                    {r.guest_phone && (
                      <p className="text-sm text-muted">
                        {r.guest_phone}
                      </p>
                    )}
                  </div>

                  {/* COURT / DATE / TIME */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted">
                        Court
                      </p>

                      <p className="text-sm font-medium text-ink">
                        {r.courts?.name ?? 'Court'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted">
                        Date
                      </p>

                      <p className="text-sm font-medium text-ink">
                        {r.date}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted">
                        Time
                      </p>

                      <p className="text-sm font-medium text-ink">
                        {r.start_time.slice(0, 5)}–
                        {r.end_time.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="w-full lg:w-auto lg:min-w-[240px]">
                  <div className="flex flex-col gap-3 rounded-lg bg-paper p-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-muted">
                        Amount
                      </span>

                      <span className="text-sm font-semibold text-ink">
                        ₱{r.amount_due ?? '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-muted">
                        Payment
                      </span>

                      <span className="text-xs capitalize text-ink">
                        {r.payment_type}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-2">
                      {paymentBadge(r.payment_status)}
                      {statusBadge(r.status)}
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {r.payment_proof_url && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedImage(r.payment_proof_url)
                        }
                        className="rounded-md border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-court hover:text-court"
                      >
                        View payment proof
                      </button>
                    )}

                    {r.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(r)}
                        className="rounded-md border border-red-900/50 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-950/30"
                      >
                        Cancel booking
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PAYMENT PROOF LIGHTBOX */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage}
              alt="Customer payment proof"
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
            />

            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-xl text-white transition-colors hover:bg-black"
              aria-label="Close image"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* CANCEL CONFIRMATION MODAL */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6">
            <h2 className="font-display text-xl font-semibold text-ink">
              Cancel booking?
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-muted">
              Are you sure you want to cancel this booking? The
              reservation will remain in the system for history, but
              the booked slot will become available again.
            </p>

            <div className="my-4 rounded-xl border border-line bg-paper p-4">
              {cancelTarget.booking_reference && (
                <p className="mb-2 text-xs font-medium text-court">
                  {cancelTarget.booking_reference}
                </p>
              )}

              <p className="font-medium text-ink">
                {getCustomerName(cancelTarget)}
              </p>

              <p className="mt-1 text-sm text-muted">
                {cancelTarget.courts?.name ?? 'Court'} ·{' '}
                {cancelTarget.date}
              </p>

              <p className="text-sm text-muted">
                {cancelTarget.start_time.slice(0, 5)}–
                {cancelTarget.end_time.slice(0, 5)}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancellingId !== null}
                className="rounded-xl border border-line px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                Keep booking
              </button>

              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancellingId !== null}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {cancellingId === cancelTarget.id
                  ? 'Cancelling...'
                  : 'Yes, cancel booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
