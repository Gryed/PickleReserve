import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Court, Settings } from '../types/court'
import type { TimeSlot } from '../types/availability'
import { getCourts, getSettings } from '../services/courtService'
import {
  getAvailableSlots,
  createReservation,
  generateBookingReference,
} from '../services/availabilityService'
import { uploadPaymentProof } from '../services/paymentService'
import { useAuth } from '../context/AuthContext'

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const BOOKING_RULES = [
  'Payment is required to confirm your booking.',
  'Bookings are non-refundable. If the court is unplayable due to weather or maintenance, contact us to reschedule.',
  'Rescheduling is allowed only when at least 24 hours advance notice is given.',
  'Please arrive on time. Bookings may be released without refund if more than 30 minutes late.',
  'Play only during your reserved time and vacate the court promptly after your session.',
]

function nextDays(count: number) {
  const days = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d)
  }
  return days
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function formatDateLong(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

interface SlotGroup {
  start: string
  end: string
  hours: number
  isSeparate: boolean
}

function groupConsecutiveSlots(slots: TimeSlot[]): SlotGroup[] {
  if (slots.length === 0) return []

  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const groups: SlotGroup[] = []
  let currentGroup: TimeSlot[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = currentGroup[currentGroup.length - 1].end_time
    if (sorted[i].start_time === prevEnd) {
      currentGroup.push(sorted[i])
    } else {
      groups.push({
        start: currentGroup[0].start_time,
        end: currentGroup[currentGroup.length - 1].end_time,
        hours: currentGroup.length,
        isSeparate: false,
      })
      currentGroup = [sorted[i]]
    }
  }
  groups.push({
    start: currentGroup[0].start_time,
    end: currentGroup[currentGroup.length - 1].end_time,
    hours: currentGroup.length,
    isSeparate: false,
  })

  if (groups.length > 1) {
    groups.forEach((g) => (g.isSeparate = true))
  }

  return groups
}

type ModalStep = 'none' | 'rules' | 'payment' | 'success'

export default function Booking() {
  const { courtId } = useParams<{ courtId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [court, setCourt] = useState<Court | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [date, setDate] = useState(() => toISODate(new Date()))
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([])
  const [slotFilter, setSlotFilter] = useState<'all' | 'available' | 'booked'>('all')
  const [paymentType, setPaymentType] = useState<'full' | 'deposit'>('full')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [agreedToRules, setAgreedToRules] = useState(false)

  const [bookAsGuest, setBookAsGuest] = useState(!user)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [modalStep, setModalStep] = useState<ModalStep>('none')
  const [bookingReference, setBookingReference] = useState('')

  const dateOptions = nextDays(settings?.booking_horizon_days ?? 60)

  useEffect(() => {
    loadCourtAndSettings()
  }, [courtId])

  useEffect(() => {
    if (court) loadSlots()
  }, [court, date])

  async function loadCourtAndSettings() {
    if (!courtId) return
    try {
      const [courts, settingsData] = await Promise.all([getCourts(), getSettings()])
      setCourt(courts.find((c) => c.id === courtId) ?? null)
      setSettings(settingsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load court')
    }
  }

  async function loadSlots() {
    if (!courtId) return
    setLoading(true)
    setSelectedSlots([])
    setSlotFilter('all')
    setAgreedToRules(false)
    try {
      const data = await getAvailableSlots(courtId, date)
      setSlots(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability')
    } finally {
      setLoading(false)
    }
  }

  function toggleSlot(slot: TimeSlot) {
    setSelectedSlots((prev) => {
      const exists = prev.find((s) => s.start_time === slot.start_time)
      if (exists) return prev.filter((s) => s.start_time !== slot.start_time)
      return [...prev, slot].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })
  }

  function removeSlot(startTime: string) {
    setSelectedSlots((prev) => prev.filter((s) => s.start_time !== startTime))
  }

  function getTotalPrice() {
    if (!court) return 0
    return court.price_per_hour * selectedSlots.length
  }

  function getAmountDue() {
    const total = getTotalPrice()
    if (paymentType === 'full') return total
    const pct = settings?.deposit_percentage ?? 50
    return Math.round((total * pct) / 100)
  }

  function openRulesModal() {
    if (bookAsGuest) {
      if (!guestName.trim() || !guestPhone.trim()) {
        setError('Please enter your name and phone number')
        return
      }
    } else if (!user) {
      navigate('/login')
      return
    }
    setError('')
    setModalStep('rules')
  }

  function proceedToPayment() {
    if (!agreedToRules) return
    setModalStep('payment')
  }

  async function handleSubmitBooking() {
    if (!courtId || selectedSlots.length === 0 || !proofFile) return

    setSubmitting(true)
    setError('')
    try {
      const amountPerSlot = getAmountDue() / selectedSlots.length
      const idPrefix = crypto.randomUUID()
      const proofUrl = await uploadPaymentProof(proofFile, idPrefix)
      const reference = await generateBookingReference()

      await Promise.all(
        selectedSlots.map((slot) =>
          createReservation({
            court_id: courtId,
            user_id: bookAsGuest ? null : user!.id,
            guest_name: bookAsGuest ? guestName.trim() : null,
            guest_phone: bookAsGuest ? guestPhone.trim() : null,
            date,
            start_time: slot.start_time,
            end_time: slot.end_time,
            payment_type: paymentType,
            amount_due: amountPerSlot,
            payment_proof_url: proofUrl,
            booking_reference: reference,
          })
        )
      )

      setBookingReference(reference)
      setModalStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit booking')
    } finally {
      setSubmitting(false)
    }
  }

  function closeModals() {
    setModalStep('none')
    setProofFile(null)
    setBookingReference('')
    setSelectedSlots([])
    loadSlots()
  }

  if (!court) {
    return <div className="p-8 max-w-2xl mx-auto text-muted">Loading court...</div>
  }

    const displayedSlots =
    slotFilter === 'available'
      ? slots.filter((s) => s.available)
      : slotFilter === 'booked'
      ? slots.filter((s) => !s.available)
      : slots

  const availableCount = slots.filter((s) => s.available).length
  const bookedCount = slots.filter((s) => !s.available).length
  const selectedGroups = groupConsecutiveSlots(selectedSlots)

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8">

        {/* =========================
            BOOKING HEADER
        ========================== */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-court mb-2">
            Book a court
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold text-ink">
                {court.name}
              </h1>

              <p className="mt-1 text-sm text-muted">
                {court.price_per_hour
                  ? `₱${court.price_per_hour} / hour`
                  : 'Court booking'}
              </p>
            </div>

            <div className="text-sm text-muted sm:text-right">
              <p className="font-medium text-ink">
                {formatDateLong(date)}
              </p>
              <p>
                {selectedSlots.length > 0
                  ? `${selectedSlots.length} hour${selectedSlots.length > 1 ? 's' : ''} selected`
                  : 'Select your preferred time'}
              </p>
            </div>
          </div>
        </div>

        {error && modalStep === 'none' && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">

          {/* =========================
              MAIN BOOKING AREA
          ========================== */}
          <main className="min-w-0 space-y-6">

            {/* DATE */}
            <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-court">
                    Step 1
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">
                    Select play date
                  </h2>
                </div>

                <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                  {dateOptions.length} days
                </span>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-2">
                  {dateOptions.map((d) => {
                    const iso = toISODate(d)
                    const isSelected = iso === date
                    const isToday = iso === toISODate(new Date())

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setDate(iso)}
                        className={
                          'relative flex h-[92px] w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border transition-all ' +
                          (isSelected
                            ? 'btn-court border-court shadow-sm'
                            : 'border-line bg-paper text-ink hover:border-court')
                        }
                      >
                        {isToday && (
                          <span
                            className={
                              'mb-1 text-[9px] font-bold tracking-wider ' +
                              (isSelected ? 'text-paper/70' : 'text-court')
                            }
                          >
                            TODAY
                          </span>
                        )}

                        <span
                          className={
                            'text-[11px] font-semibold ' +
                            (isSelected ? 'text-paper/70' : 'text-muted')
                          }
                        >
                          {WEEKDAY[d.getDay()]}
                        </span>

                        <span className="font-display text-2xl font-semibold">
                          {d.getDate()}
                        </span>

                        <span
                          className={
                            'text-[10px] font-medium ' +
                            (isSelected ? 'text-paper/70' : 'text-muted')
                          }
                        >
                          {MONTH[d.getMonth()]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* TIME SLOTS */}
            <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-court">
                    Step 2
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-ink">
                    Select time
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    You can select multiple time slots.
                  </p>
                </div>

                {!loading && slots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['all', `All ${slots.length}`],
                      ['available', `Available ${availableCount}`],
                      ['booked', `Booked ${bookedCount}`],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setSlotFilter(
                            value as 'all' | 'available' | 'booked'
                          )
                        }
                        className={
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
                          (slotFilter === value
                            ? 'btn-court border-court'
                            : 'border-line text-muted hover:border-court hover:text-ink')
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {loading && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[76px] animate-pulse rounded-xl border border-line bg-paper"
                    />
                  ))}
                </div>
              )}

              {!loading && slots.length === 0 && (
                <div className="rounded-xl border border-dashed border-line bg-paper px-5 py-10 text-center">
                  <p className="font-medium text-ink">
                    No available schedule
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    This court is closed or unavailable on this date.
                  </p>
                </div>
              )}

              {!loading && slots.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {displayedSlots.map((slot) => {
                      const isSelected = selectedSlots.some(
                        (s) => s.start_time === slot.start_time
                      )

                      if (!slot.available) {
                        return (
                          <button
                            key={slot.start_time}
                            type="button"
                            disabled
                            className="flex min-h-[76px] cursor-not-allowed flex-col items-center justify-center rounded-xl border border-red-900/30 bg-red-950/20 px-3 py-3 text-center text-red-400"
                          >
                            <span className="text-sm font-semibold line-through">
                              {formatTime(slot.start_time)}
                            </span>

                            <span className="text-[11px]">
                              {formatTime(slot.end_time)}
                            </span>

                            <span className="mt-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                              Booked
                            </span>
                          </button>
                        )
                      }

                      return (
                        <button
                          key={slot.start_time}
                          type="button"
                          onClick={() => toggleSlot(slot)}
                          className={
                            'group flex min-h-[76px] flex-col items-center justify-center rounded-xl border px-3 py-3 text-center transition-all ' +
                            (isSelected
                              ? 'btn-court border-court shadow-md'
                              : 'border-line bg-paper text-ink hover:-translate-y-0.5 hover:border-court hover:shadow-sm')
                          }
                        >
                          <span className="text-sm font-semibold">
                            {formatTime(slot.start_time)}
                          </span>

                          <span
                            className={
                              'text-[11px] ' +
                              (isSelected
                                ? 'text-paper/70'
                                : 'text-muted')
                            }
                          >
                            {formatTime(slot.end_time)}
                          </span>

                          <span
                            className={
                              'mt-1 text-[11px] font-medium ' +
                              (isSelected
                                ? 'text-paper/80'
                                : 'text-court')
                            }
                          >
                            ₱{court.price_per_hour}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-muted">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full border border-line bg-paper" />
                      Available
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-court" />
                      Selected
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      Booked
                    </span>
                  </div>
                </>
              )}
            </section>

            {/* CUSTOMER DETAILS */}
            {selectedSlots.length > 0 && (
              <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-court">
                    Step 3
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-ink">
                    Customer details
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    No account is required to complete your booking.
                  </p>
                </div>

                {user && (
                  <div className="mb-5">
                    <label className="mb-2 block text-sm font-medium text-ink">
                      Booking type
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBookAsGuest(false)}
                        className={
                          'rounded-xl border px-4 py-3 text-sm font-medium transition-colors ' +
                          (!bookAsGuest
                            ? 'btn-court border-court'
                            : 'border-line text-muted hover:border-court')
                        }
                      >
                        My account
                      </button>

                      <button
                        type="button"
                        onClick={() => setBookAsGuest(true)}
                        className={
                          'rounded-xl border px-4 py-3 text-sm font-medium transition-colors ' +
                          (bookAsGuest
                            ? 'btn-court border-court'
                            : 'border-line text-muted hover:border-court')
                        }
                      >
                        Guest
                      </button>
                    </div>
                  </div>
                )}

                {bookAsGuest && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-ink">
                        Full name
                      </label>

                      <input
                        type="text"
                        placeholder="Juan Dela Cruz"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-court"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-ink">
                        Mobile number
                      </label>

                      <input
                        type="tel"
                        placeholder="09XX XXX XXXX"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-court"
                      />
                    </div>
                  </div>
                )}

                {/* PAYMENT OPTION */}
                <div className="mt-6 border-t border-line pt-5">
                  <label className="mb-3 block text-sm font-medium text-ink">
                    Payment option
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType('full')}
                      className={
                        'rounded-xl border p-4 text-left transition-colors ' +
                        (paymentType === 'full'
                          ? 'border-court bg-court/10'
                          : 'border-line bg-paper hover:border-court')
                      }
                    >
                      <p className="text-sm font-semibold text-ink">
                        Full payment
                      </p>

                      <p className="mt-1 text-xs text-muted">
                        Pay ₱{getTotalPrice()} now
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentType('deposit')}
                      className={
                        'rounded-xl border p-4 text-left transition-colors ' +
                        (paymentType === 'deposit'
                          ? 'border-court bg-court/10'
                          : 'border-line bg-paper hover:border-court')
                      }
                    >
                      <p className="text-sm font-semibold text-ink">
                        Deposit
                      </p>

                      <p className="mt-1 text-xs text-muted">
                        {settings?.deposit_percentage ?? 50}% deposit · ₱
                        {Math.round(
                          (getTotalPrice() *
                            (settings?.deposit_percentage ?? 50)) /
                            100
                        )}
                      </p>
                    </button>
                  </div>
                </div>
              </section>
            )}
          </main>

          {/* =========================
              DESKTOP SUMMARY
          ========================== */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="border-b border-line p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-court">
                    Booking summary
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-ink">
                    {court.name}
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    {formatDateLong(date)}
                  </p>
                </div>

                <div className="p-5">
                  {selectedSlots.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line bg-paper px-4 py-8 text-center">
                      <p className="text-sm font-medium text-ink">
                        No time selected
                      </p>

                      <p className="mt-1 text-xs text-muted">
                        Choose one or more available slots to continue.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {selectedGroups.map((group, index) => (
                          <div
                            key={`${group.start}-${group.end}`}
                            className="rounded-xl border border-line bg-paper p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-ink">
                                  {formatTime(group.start)} – {formatTime(group.end)}
                                </p>

                                <p className="mt-0.5 text-xs text-muted">
                                  {group.hours} hour
                                  {group.hours > 1 ? 's' : ''}
                                  {group.isSeparate ? ' · Separate slot' : ''}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const groupSlots = selectedSlots.filter(
                                    (slot) =>
                                      slot.start_time >= group.start &&
                                      slot.end_time <= group.end
                                  )

                                  groupSlots.forEach((slot) =>
                                    removeSlot(slot.start_time)
                                  )
                                }}
                                className="text-xs text-muted hover:text-red-400"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="my-5 border-t border-line" />

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted">Hours</span>
                          <span className="font-medium text-ink">
                            {selectedSlots.length}
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-muted">Rate</span>
                          <span className="font-medium text-ink">
                            ₱{court.price_per_hour} / hr
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-muted">Payment</span>
                          <span className="font-medium capitalize text-ink">
                            {paymentType}
                          </span>
                        </div>
                      </div>

                      <div className="my-5 border-t border-line" />

                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs text-muted">Total</p>
                          <p className="mt-1 font-display text-3xl font-semibold text-ink">
                            ₱{getTotalPrice()}
                          </p>
                        </div>

                        {paymentType === 'deposit' && (
                          <div className="text-right">
                            <p className="text-xs text-muted">Due now</p>
                            <p className="font-semibold text-court">
                              ₱{getAmountDue()}
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={openRulesModal}
                        className="btn-court mt-5 w-full rounded-xl px-5 py-3.5 text-sm font-semibold transition-all hover:opacity-90"
                      >
                        Continue to booking →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* =========================
          MOBILE STICKY SUMMARY
      ========================== */}
      {selectedSlots.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-2xl backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-court">
                {court.name}
              </p>

              <p className="truncate text-sm font-medium text-ink">
                {selectedGroups
                  .map(
                    (group) =>
                      `${formatTime(group.start)}–${formatTime(group.end)}`
                  )
                  .join(' · ')}
              </p>

              <p className="text-xs text-muted">
                {selectedSlots.length} hr
                {selectedSlots.length > 1 ? 's' : ''} · ₱{getTotalPrice()}
              </p>
            </div>

            <button
              type="button"
              onClick={openRulesModal}
              className="btn-court shrink-0 rounded-xl px-5 py-3 text-sm font-semibold"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Rules modal */}
      {modalStep === 'rules' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-line rounded-lg max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-line">
              <h2 className="font-display text-xl font-semibold text-ink">Booking rules</h2>
              <p className="text-sm text-muted mt-1">Please review these rules before continuing.</p>
            </div>

            <div className="p-6">
              <ol className="space-y-3 text-sm text-muted mb-6 list-decimal list-inside">
                {BOOKING_RULES.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ol>

              <label className="flex items-start gap-2 text-sm text-ink cursor-pointer mb-6">
                <input
                  type="checkbox"
                  checked={agreedToRules}
                  onChange={(e) => setAgreedToRules(e.target.checked)}
                  className="mt-0.5"
                />
                I have read and agree to the booking rules.
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => setModalStep('none')}
                  className="flex-1 border border-line text-ink px-4 py-2 rounded-md font-medium hover:border-court transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={proceedToPayment}
                  disabled={!agreedToRules}
                  className="flex-1 btn-court px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-40"
                >
                  Continue to payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {modalStep === 'payment' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-line rounded-lg max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-line">
              <h2 className="font-display text-xl font-semibold text-ink">Complete payment</h2>
              <p className="text-sm text-muted mt-1">
                Pay ₱{getAmountDue()} via GCash, then upload your payment screenshot.
              </p>
            </div>

            <div className="p-6">
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

              {settings?.gcash_qr_url && (
                <img
                  src={settings.gcash_qr_url}
                  alt="GCash QR"
                  className="w-40 h-40 object-contain border border-line rounded-lg mb-4 bg-white mx-auto"
                />
              )}
              {(settings?.gcash_number || settings?.gcash_name) && (
                <div className="mb-4 text-sm text-ink space-y-1">
                  {settings.gcash_name && (
                    <p>
                      Account name: <span className="font-medium">{settings.gcash_name}</span>
                    </p>
                  )}
                  {settings.gcash_number && (
                    <p>
                      GCash number: <span className="font-medium">{settings.gcash_number}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-muted mb-2">Upload payment screenshot</label>
                <label className="flex items-center justify-center gap-2 border border-dashed border-line rounded-lg px-4 py-6 cursor-pointer hover:border-court transition-colors bg-paper">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <span className="text-sm text-muted text-center">
                    {proofFile ? (
                      <span className="text-ink font-medium">{proofFile.name}</span>
                    ) : (
                      <>
                        <span className="text-court font-medium">Tap to upload</span> a screenshot
                      </>
                    )}
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setModalStep('rules')}
                  className="flex-1 border border-line text-ink px-4 py-2 rounded-md font-medium hover:border-court transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitBooking}
                  disabled={!proofFile || submitting}
                  className="flex-1 btn-court px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-40"
                >
                  {submitting ? 'Submitting...' : 'Confirm booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {modalStep === 'success' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-line rounded-lg max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-court/15 text-court flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <h2 className="font-display text-xl font-semibold text-ink mb-2">Booking submitted</h2>
            <p className="text-sm text-muted mb-1">
              Your payment proof has been sent for verification. You'll be notified once confirmed.
            </p>

            <div className="bg-paper border border-line rounded-lg py-3 px-4 my-4">
              <p className="text-xs text-muted mb-1">Booking reference</p>
              <p className="font-display text-lg font-semibold text-court tracking-wide">{bookingReference}</p>
            </div>
            <p className="text-xs text-muted mb-6">Save this reference to look up your booking later.</p>

            <button onClick={closeModals} className="btn-court px-6 py-2 rounded-md font-medium transition-colors w-full">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}