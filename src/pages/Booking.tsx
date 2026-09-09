import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const BOOKING_RULES = [
  'Payment is required to confirm your booking.',
  'Bookings are non-refundable. If the court is unplayable due to weather or maintenance, contact us to reschedule.',
  'Rescheduling is allowed only when at least 24 hours advance notice is given.',
  'Please arrive on time. Bookings may be released without refund if more than 30 minutes late.',
  'Play only during your reserved time and vacate the court promptly after your session.',
]

function toISODate(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatWeekday(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
  })
}

function formatMonth(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
  })
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)

  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12

  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function formatDateLong(iso: string) {
  const d = new Date(iso + 'T00:00:00')

  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface SlotGroup {
  start: string
  end: string
  hours: number
  isSeparate: boolean
}

function groupConsecutiveSlots(slots: TimeSlot[]): SlotGroup[] {
  if (slots.length === 0) return []

  const sorted = [...slots].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  )

  const groups: SlotGroup[] = []
  let currentGroup: TimeSlot[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const previous = currentGroup[currentGroup.length - 1]

    if (sorted[i].start_time === previous.end_time) {
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
    groups.forEach((group) => {
      group.isSeparate = true
    })
  }

  return groups
}

type ModalStep =
  | 'none'
  | 'rules'
  | 'payment'
  | 'success'

export default function Booking() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [courts, setCourts] = useState<Court[]>([])
  const [court, setCourt] = useState<Court | null>(null)
  const [selectedCourtId, setSelectedCourtId] = useState('')

  const [settings, setSettings] =
    useState<Settings | null>(null)

  const [date, setDate] = useState(() =>
    toISODate(new Date())
  )

  const [dateWindowStart, setDateWindowStart] =
    useState(() => new Date())

  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlots, setSelectedSlots] =
    useState<TimeSlot[]>([])

  const [slotFilter, setSlotFilter] = useState<
    'all' | 'available' | 'booked'
  >('all')

  const [paymentType, setPaymentType] =
    useState<'full' | 'deposit'>('full')

  const [proofFile, setProofFile] =
    useState<File | null>(null)

  const [agreedToRules, setAgreedToRules] =
    useState(false)

  const [bookAsGuest, setBookAsGuest] =
    useState(!user)

  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  const [customerDetailsOpen, setCustomerDetailsOpen] =
    useState(false)

  const [loadingCourts, setLoadingCourts] =
    useState(true)

  const [loadingSlots, setLoadingSlots] =
    useState(false)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] = useState('')

  const [modalStep, setModalStep] =
    useState<ModalStep>('none')

  const [bookingReference, setBookingReference] =
    useState('')

  const bookingHorizon =
    settings?.booking_horizon_days ?? 60

  const dateWindow = Array.from(
    { length: 7 },
    (_, index) =>
      addDays(dateWindowStart, index)
  )

  const mobileDateWindow =
    dateWindow.slice(0, 5)

  const todayISO = toISODate(new Date())

  const maxBookingDate = addDays(
    new Date(),
    Math.max(0, bookingHorizon - 1)
  )

  const canGoPrevious =
    toISODate(dateWindowStart) > todayISO

  const canGoNext =
    toISODate(addDays(dateWindowStart, 7)) <=
    toISODate(maxBookingDate)

  useEffect(() => {
    loadCourtAndSettings()
  }, [])

  useEffect(() => {
    if (
      !selectedCourtId ||
      courts.length === 0
    ) {
      return
    }

    const selected = courts.find(
      (item) =>
        item.id === selectedCourtId
    )

    if (!selected) {
      return
    }

    setCourt(selected)

    if (selected.status !== 'available') {
      setSlots([])
      setSelectedSlots([])
      setLoadingSlots(false)
      return
    }

    loadSlots(selectedCourtId, date)
  }, [selectedCourtId, date])

  async function loadCourtAndSettings() {
    try {
      setLoadingCourts(true)
      setError('')

      const [courtList, settingsData] =
        await Promise.all([
          getCourts(),
          getSettings(),
        ])

      setCourts(courtList)
      setSettings(settingsData)

      const firstAvailableCourt =
        courtList.find(
          (item) =>
            item.status === 'available'
        )

      if (firstAvailableCourt) {
        setSelectedCourtId(
          firstAvailableCourt.id
        )

        setCourt(firstAvailableCourt)
      } else {
        setSelectedCourtId('')
        setCourt(null)
        setSlots([])
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load booking information'
      )
    } finally {
      setLoadingCourts(false)
    }
  }

  async function loadSlots(
    courtId: string,
    bookingDate: string
  ) {
    if (!courtId || !bookingDate) {
      return
    }

    setLoadingSlots(true)
    setSelectedSlots([])
    setSlotFilter('all')
    setAgreedToRules(false)
    setCustomerDetailsOpen(false)
    setError('')

    try {
      const data =
        await getAvailableSlots(
          courtId,
          bookingDate
        )

      setSlots(data)
    } catch (err) {
      setSlots([])

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load availability'
      )
    } finally {
      setLoadingSlots(false)
    }
  }

  function handleCourtChange(
    courtId: string
  ) {
    const selected = courts.find(
      (item) =>
        item.id === courtId
    )

    if (!selected) return

    setSelectedCourtId(courtId)
    setCourt(selected)
    setSelectedSlots([])
    setSlotFilter('all')
    setAgreedToRules(false)
    setCustomerDetailsOpen(false)
    setModalStep('none')
    setError('')
  }

  function toggleSlot(slot: TimeSlot) {
    if (!slot.available) return

    setError('')

    setSelectedSlots((previous) => {
      const exists = previous.find(
        (selected) =>
          selected.start_time ===
          slot.start_time
      )

      if (exists) {
        return previous.filter(
          (selected) =>
            selected.start_time !==
            slot.start_time
        )
      }

      return [...previous, slot].sort(
        (a, b) =>
          a.start_time.localeCompare(
            b.start_time
          )
      )
    })
  }

  function removeSlot(
    startTime: string
  ) {
    setSelectedSlots((previous) =>
      previous.filter(
        (slot) =>
          slot.start_time !== startTime
      )
    )

    setError('')
  }

  function getTotalPrice() {
    if (!court) return 0

    return (
      court.price_per_hour *
      selectedSlots.length
    )
  }

  function getAmountDue() {
    const total = getTotalPrice()

    if (paymentType === 'full') {
      return total
    }

    const percentage =
      settings?.deposit_percentage ?? 50

    return Math.round(
      (total * percentage) / 100
    )
  }

  function openRulesModal() {
    if (bookAsGuest) {
      if (
        !guestName.trim() ||
        !guestPhone.trim()
      ) {
        setError(
          'Please enter your name and phone number'
        )
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

    setError('')
    setModalStep('payment')
  }

  async function handleSubmitBooking() {
    if (
      !selectedCourtId ||
      selectedSlots.length === 0 ||
      !proofFile
    ) {
      return
    }

    if (!bookAsGuest && !user) {
      setError(
        'Please log in before booking with an account.'
      )
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const amountPerSlot =
        getAmountDue() /
        selectedSlots.length

      const idPrefix =
        crypto.randomUUID()

      const proofUrl =
        await uploadPaymentProof(
          proofFile,
          idPrefix
        )

      const reference =
        await generateBookingReference()

      await Promise.all(
        selectedSlots.map((slot) =>
          createReservation({
            court_id: selectedCourtId,

            user_id:
              bookAsGuest
                ? null
                : user!.id,

            guest_name:
              bookAsGuest
                ? guestName.trim()
                : null,

            guest_phone:
              bookAsGuest
                ? guestPhone.trim()
                : null,

            date,

            start_time:
              slot.start_time,

            end_time:
              slot.end_time,

            payment_type:
              paymentType,

            amount_due:
              amountPerSlot,

            payment_proof_url:
              proofUrl,

            booking_reference:
              reference,
          })
        )
      )

      setBookingReference(reference)
      setModalStep('success')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit booking'
      )
    } finally {
      setSubmitting(false)
    }
  }

  function closeModals() {
    setModalStep('none')
    setProofFile(null)
    setBookingReference('')
    setSelectedSlots([])
    setError('')

    if (selectedCourtId) {
      loadSlots(
        selectedCourtId,
        date
      )
    }
  }

  if (loadingCourts) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-muted">
        Loading booking...
      </div>
    )
  }

  /*
   * IMPORTANT:
   * Don't return early when there are no available courts.
   * We still want maintenance / unavailable courts
   * to be visible.
   */
  if (courts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <p className="font-medium text-ink">
          No courts found
        </p>

        <p className="mt-1 text-sm text-muted">
          Please check again later.
        </p>
      </div>
    )
  }

  /*
   * If selected court somehow becomes unavailable,
   * automatically select the first available one.
   */
  if (
    !court &&
    courts.some(
      (item) =>
        item.status === 'available'
    )
  ) {
    const firstAvailable =
      courts.find(
        (item) =>
          item.status === 'available'
      )

    if (firstAvailable) {
      setCourt(firstAvailable)
      setSelectedCourtId(
        firstAvailable.id
      )
    }
  }

  const displayedSlots =
    slotFilter === 'available'
      ? slots.filter(
          (slot) => slot.available
        )
      : slotFilter === 'booked'
        ? slots.filter(
            (slot) => !slot.available
          )
        : slots

  const availableCount =
    slots.filter(
      (slot) => slot.available
    ).length

  const bookedCount =
    slots.filter(
      (slot) => !slot.available
    ).length

  const selectedGroups =
    groupConsecutiveSlots(
      selectedSlots
    )

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8">

        {/* HEADER */}
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-court">
            Book a court
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold text-ink">
                {court?.name ?? 'Select a court'}
              </h1>

              {court && (
                <p className="mt-1 text-sm text-muted">
                  ₱{court.price_per_hour} / hour
                </p>
              )}
            </div>

            <div className="text-sm text-muted sm:text-right">
              <p className="font-medium text-ink">
                {formatDateLong(date)}
              </p>

              <p>
                {selectedSlots.length > 0
                  ? `${selectedSlots.length} hour${
                      selectedSlots.length > 1
                        ? 's'
                        : ''
                    } selected`
                  : 'Select your preferred time'}
              </p>
            </div>
          </div>
        </div>

        {/* COURT SELECTION */}
        <section className="mb-6 rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-court">
              Choose a court
            </p>

            <h2 className="mt-1 text-lg font-semibold text-ink">
              Select your preferred court
            </h2>

            <p className="mt-1 text-sm text-muted">
              Choose a court before selecting your date and time.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courts.map((item) => {
              const isSelected =
                selectedCourtId === item.id

              const isAvailable =
                item.status === 'available'

              const isMaintenance =
                item.status === 'maintenance'

              const isNotAvailable =
                item.status === 'not_available'

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => {
                    if (!isAvailable) return

                    handleCourtChange(
                      item.id
                    )
                  }}
                  className={
                    'rounded-xl border p-4 text-left transition-all ' +
                    (isAvailable
                      ? isSelected
                        ? 'border-court bg-court/10 ring-2 ring-court/20'
                        : 'border-line bg-paper hover:border-court hover:shadow-sm'
                      : 'cursor-not-allowed border-line bg-paper/60 opacity-70')
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {item.name}
                      </p>

                      <p className="mt-1 text-sm text-muted">
                        ₱{item.price_per_hour} / hour
                      </p>
                    </div>

                    {isSelected &&
                      isAvailable && (
                        <span className="rounded-full bg-court px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-paper">
                          Selected
                        </span>
                      )}
                  </div>

                  <div className="mt-4">
                    {isAvailable && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-court/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-court">
                        <span className="h-1.5 w-1.5 rounded-full bg-court" />
                        Available
                      </span>
                    )}

                    {isMaintenance && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Maintenance
                      </span>
                    )}

                    {isNotAvailable && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        Not Available
                      </span>
                    )}
                  </div>

                  <div className="mt-4 border-t border-line pt-3">
                    <span
                      className={
                        'text-[10px] font-bold uppercase tracking-wider ' +
                        (isAvailable
                          ? 'text-court'
                          : isMaintenance
                            ? 'text-amber-400'
                            : 'text-red-400')
                      }
                    >
                      {isAvailable
                        ? 'Select court'
                        : isMaintenance
                          ? 'Under maintenance'
                          : 'Currently unavailable'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">

          {/* MAIN */}
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
                  {bookingHorizon} days
                </span>
              </div>

              <div className="relative">
                <div className="flex items-center gap-2">

                  {/* PREVIOUS */}
                  <button
                    type="button"
                    disabled={!canGoPrevious}
                    onClick={() =>
                      setDateWindowStart(
                        (previous) =>
                          addDays(
                            previous,
                            -7
                          )
                      )
                    }
                    className="flex h-12 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-xl text-muted transition-colors hover:border-court hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 sm:w-10"
                    aria-label="Previous dates"
                  >
                    ‹
                  </button>

                  {/* MOBILE DATES */}
                  <div className="grid flex-1 grid-cols-5 gap-1 sm:hidden">
                    {mobileDateWindow.map(
                      (d) => {
                        const iso =
                          toISODate(d)

                        const isSelected =
                          iso === date

                        const isPast =
                          iso < todayISO

                        const isBeyondHorizon =
                          iso >
                          toISODate(
                            maxBookingDate
                          )

                        const disabled =
                          isPast ||
                          isBeyondHorizon

                        return (
                          <button
                            key={iso}
                            type="button"
                            disabled={
                              disabled
                            }
                            onClick={() => {
                              setDate(iso)
                              setError('')
                            }}
                            className={
                              'flex min-w-0 flex-col items-center justify-center rounded-xl border px-0.5 py-2.5 transition-all ' +
                              (disabled
                                ? 'cursor-not-allowed border-line bg-paper/50 opacity-30'
                                : isSelected
                                  ? 'btn-court border-court shadow-sm'
                                  : 'border-line bg-paper text-ink hover:border-court')
                            }
                          >
                            <span
                              className={
                                'text-[9px] font-semibold uppercase tracking-wide ' +
                                (isSelected
                                  ? 'text-paper/70'
                                  : 'text-muted')
                              }
                            >
                              {formatWeekday(
                                d
                              )}
                            </span>

                            <span className="mt-0.5 font-display text-lg font-semibold">
                              {d.getDate()}
                            </span>

                            <span
                              className={
                                'text-[9px] font-medium uppercase ' +
                                (isSelected
                                  ? 'text-paper/70'
                                  : 'text-muted')
                              }
                            >
                              {formatMonth(
                                d
                              )}
                            </span>
                          </button>
                        )
                      }
                    )}
                  </div>

                  {/* DESKTOP DATES */}
                  <div className="hidden flex-1 grid-cols-7 gap-2 sm:grid">
                    {dateWindow.map(
                      (d) => {
                        const iso =
                          toISODate(d)

                        const isSelected =
                          iso === date

                        const isPast =
                          iso < todayISO

                        const isBeyondHorizon =
                          iso >
                          toISODate(
                            maxBookingDate
                          )

                        const disabled =
                          isPast ||
                          isBeyondHorizon

                        return (
                          <button
                            key={iso}
                            type="button"
                            disabled={
                              disabled
                            }
                            onClick={() => {
                              setDate(iso)
                              setError('')
                            }}
                            className={
                              'flex min-w-0 flex-col items-center justify-center rounded-xl border px-1 py-3 transition-all ' +
                              (disabled
                                ? 'cursor-not-allowed border-line bg-paper/50 opacity-30'
                                : isSelected
                                  ? 'btn-court border-court shadow-sm'
                                  : 'border-line bg-paper text-ink hover:border-court')
                            }
                          >
                            <span
                              className={
                                'text-[10px] font-semibold uppercase tracking-wide ' +
                                (isSelected
                                  ? 'text-paper/70'
                                  : 'text-muted')
                              }
                            >
                              {formatWeekday(
                                d
                              )}
                            </span>

                            <span className="mt-1 font-display text-xl font-semibold">
                              {d.getDate()}
                            </span>

                            <span
                              className={
                                'text-[10px] font-medium uppercase ' +
                                (isSelected
                                  ? 'text-paper/70'
                                  : 'text-muted')
                              }
                            >
                              {formatMonth(
                                d
                              )}
                            </span>
                          </button>
                        )
                      }
                    )}
                  </div>

                  {/* NEXT */}
                  <button
                    type="button"
                    disabled={!canGoNext}
                    onClick={() =>
                      setDateWindowStart(
                        (previous) =>
                          addDays(
                            previous,
                            7
                          )
                      )
                    }
                    className="flex h-12 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-xl text-muted transition-colors hover:border-court hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 sm:w-10"
                    aria-label="Next dates"
                  >
                    ›
                  </button>
                </div>

                <div className="mt-4 text-center">
                  <p className="text-sm font-medium text-ink">
                    Selected:{' '}
                    {formatDateLong(date)}
                  </p>

                  {date === todayISO && (
                    <p className="mt-1 text-xs font-semibold text-court">
                      Today
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* TIME */}
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

                {!loadingSlots &&
                  slots.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        [
                          'all',
                          `All ${slots.length}`,
                        ],
                        [
                          'available',
                          `Available ${availableCount}`,
                        ],
                        [
                          'booked',
                          `Booked ${bookedCount}`,
                        ],
                      ].map(
                        ([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setSlotFilter(
                                value as
                                  | 'all'
                                  | 'available'
                                  | 'booked'
                              )
                            }
                            className={
                              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
                              (slotFilter ===
                              value
                                ? 'btn-court border-court'
                                : 'border-line text-muted hover:border-court hover:text-ink')
                            }
                          >
                            {label}
                          </button>
                        )
                      )}
                    </div>
                  )}
              </div>

              {loadingSlots && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {Array.from({
                    length: 12,
                  }).map(
                    (_, index) => (
                      <div
                        key={index}
                        className="h-[76px] animate-pulse rounded-xl border border-line bg-paper"
                      />
                    )
                  )}
                </div>
              )}

              {!loadingSlots &&
                slots.length === 0 && (
                  <div className="rounded-xl border border-dashed border-line bg-paper px-5 py-10 text-center">
                    <p className="font-medium text-ink">
                      No available schedule
                    </p>

                    <p className="mt-1 text-sm text-muted">
                      This court is closed or unavailable on this date.
                    </p>
                  </div>
                )}

              {!loadingSlots &&
                slots.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                      {displayedSlots.map(
                        (slot) => {
                          const isSelected =
                            selectedSlots.some(
                              (selected) =>
                                selected.start_time ===
                                slot.start_time
                            )

                          if (
                            !slot.available
                          ) {
                            return (
                              <button
                                key={
                                  slot.start_time
                                }
                                type="button"
                                disabled
                                className="flex min-h-[76px] cursor-not-allowed flex-col items-center justify-center rounded-xl border border-red-900/30 bg-red-950/20 px-3 py-3 text-center text-red-400"
                              >
                                <span className="text-sm font-semibold line-through">
                                  {formatTime(
                                    slot.start_time
                                  )}
                                </span>

                                <span className="text-[11px]">
                                  {formatTime(
                                    slot.end_time
                                  )}
                                </span>

                                <span className="mt-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                  Booked
                                </span>
                              </button>
                            )
                          }

                          return (
                            <button
                              key={
                                slot.start_time
                              }
                              type="button"
                              onClick={() =>
                                toggleSlot(
                                  slot
                                )
                              }
                              className={
                                'group flex min-h-[76px] flex-col items-center justify-center rounded-xl border px-3 py-3 text-center transition-all ' +
                                (isSelected
                                  ? 'btn-court border-court shadow-md'
                                  : 'border-line bg-paper text-ink hover:-translate-y-0.5 hover:border-court hover:shadow-sm')
                              }
                            >
                              <span className="text-sm font-semibold">
                                {formatTime(
                                  slot.start_time
                                )}
                              </span>

                              <span
                                className={
                                  'text-[11px] ' +
                                  (isSelected
                                    ? 'text-paper/70'
                                    : 'text-muted')
                                }
                              >
                                {formatTime(
                                  slot.end_time
                                )}
                              </span>

                              <span
                                className={
                                  'mt-1 text-[11px] font-medium ' +
                                  (isSelected
                                    ? 'text-paper/80'
                                    : 'text-court')
                                }
                              >
                                ₱
                                {
                                  court
                                    ?.price_per_hour
                                }
                              </span>
                            </button>
                          )
                        }
                      )}
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
            {selectedSlots.length > 0 &&
              court && (
                <>
                  {/* DESKTOP */}
                  <section className="hidden rounded-2xl border border-line bg-surface p-4 sm:p-5 lg:block">
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
                            onClick={() => {
                              setBookAsGuest(
                                false
                              )
                              setError('')
                            }}
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
                            onClick={() => {
                              setBookAsGuest(
                                true
                              )
                              setError('')
                            }}
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
                            value={
                              guestName
                            }
                            onChange={(
                              e
                            ) => {
                              setGuestName(
                                e.target.value
                              )

                              if (
                                error
                              ) {
                                setError(
                                  ''
                                )
                              }
                            }}
                            className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-court"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-ink">
                            Mobile number
                          </label>

                          <input
                            type="tel"
                            placeholder="09XX XXX XXXX"
                            value={
                              guestPhone
                            }
                            onChange={(
                              e
                            ) => {
                              setGuestPhone(
                                e.target.value
                              )

                              if (
                                error
                              ) {
                                setError(
                                  ''
                                )
                              }
                            }}
                            className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-court"
                          />

                          {error && (
                            <p className="mt-3 text-sm font-medium text-red-400">
                              {error}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 border-t border-line pt-5">
                      <label className="mb-3 block text-sm font-medium text-ink">
                        Payment option
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentType(
                              'full'
                            )
                          }
                          className={
                            'rounded-xl border p-4 text-left transition-colors ' +
                            (paymentType ===
                            'full'
                              ? 'border-court bg-court/10'
                              : 'border-line bg-paper hover:border-court')
                          }
                        >
                          <p className="text-sm font-semibold text-ink">
                            Full payment
                          </p>

                          <p className="mt-1 text-xs text-muted">
                            Pay ₱
                            {getTotalPrice()}{' '}
                            now
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPaymentType(
                              'deposit'
                            )
                          }
                          className={
                            'rounded-xl border p-4 text-left transition-colors ' +
                            (paymentType ===
                            'deposit'
                              ? 'border-court bg-court/10'
                              : 'border-line bg-paper hover:border-court')
                          }
                        >
                          <p className="text-sm font-semibold text-ink">
                            Deposit
                          </p>

                          <p className="mt-1 text-xs text-muted">
                            {
                              settings?.deposit_percentage ??
                              50
                            }
                            % deposit · ₱
                            {Math.round(
                              (getTotalPrice() *
                                (settings?.deposit_percentage ??
                                  50)) /
                                100
                            )}
                          </p>
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* MOBILE CUSTOMER SHEET */}
                  {customerDetailsOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                      <button
                        type="button"
                        aria-label="Close customer details"
                        onClick={() => {
                          setCustomerDetailsOpen(
                            false
                          )
                          setError('')
                        }}
                        className="absolute inset-0 bg-black/70"
                      />

                      <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface shadow-2xl">
                        <div className="flex justify-center pt-3">
                          <div className="h-1.5 w-12 rounded-full bg-line" />
                        </div>

                        <div className="flex items-center justify-between border-b border-line px-5 py-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-court">
                              Step 3
                            </p>

                            <h2 className="mt-1 text-lg font-semibold text-ink">
                              Customer details
                            </h2>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setCustomerDetailsOpen(
                                false
                              )
                              setError('')
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg text-muted hover:text-ink"
                            aria-label="Close"
                          >
                            ×
                          </button>
                        </div>

                        <div className="space-y-5 p-5 pb-8">
                          {user && (
                            <div>
                              <label className="mb-2 block text-sm font-medium text-ink">
                                Booking type
                              </label>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBookAsGuest(
                                      false
                                    )
                                    setError('')
                                  }}
                                  className={
                                    'rounded-xl border px-4 py-3 text-sm font-medium transition-colors ' +
                                    (!bookAsGuest
                                      ? 'btn-court border-court'
                                      : 'border-line text-muted')
                                  }
                                >
                                  My account
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setBookAsGuest(
                                      true
                                    )
                                    setError('')
                                  }}
                                  className={
                                    'rounded-xl border px-4 py-3 text-sm font-medium transition-colors ' +
                                    (bookAsGuest
                                      ? 'btn-court border-court'
                                      : 'border-line text-muted')
                                  }
                                >
                                  Guest
                                </button>
                              </div>
                            </div>
                          )}

                          {bookAsGuest && (
                            <div className="space-y-4">
                              <div>
                                <label className="mb-2 block text-sm font-medium text-ink">
                                  Full name
                                </label>

                                <input
                                  type="text"
                                  placeholder="Juan Dela Cruz"
                                  value={
                                    guestName
                                  }
                                  onChange={(
                                    e
                                  ) => {
                                    setGuestName(
                                      e.target.value
                                    )

                                    if (
                                      error
                                    ) {
                                      setError(
                                        ''
                                      )
                                    }
                                  }}
                                  className="w-full rounded-xl border border-line bg-paper px-4 py-3.5 text-sm text-ink outline-none placeholder:text-muted focus:border-court"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-ink">
                                  Mobile number
                                </label>

                                <input
                                  type="tel"
                                  placeholder="09XX XXX XXXX"
                                  value={
                                    guestPhone
                                  }
                                  onChange={(
                                    e
                                  ) => {
                                    setGuestPhone(
                                      e.target.value
                                    )

                                    if (
                                      error
                                    ) {
                                      setError(
                                        ''
                                      )
                                    }
                                  }}
                                  className="w-full rounded-xl border border-line bg-paper px-4 py-3.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-court"
                                />

                                {error && (
                                  <p className="mt-3 text-sm font-medium text-red-400">
                                    {error}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="border-t border-line pt-5">
                            <label className="mb-3 block text-sm font-medium text-ink">
                              Payment option
                            </label>

                            <div className="space-y-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setPaymentType(
                                    'full'
                                  )
                                }
                                className={
                                  'w-full rounded-xl border p-4 text-left transition-colors ' +
                                  (paymentType ===
                                  'full'
                                    ? 'border-court bg-court/10'
                                    : 'border-line bg-paper')
                                }
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-ink">
                                      Full payment
                                    </p>

                                    <p className="mt-1 text-xs text-muted">
                                      Pay ₱
                                      {getTotalPrice()}{' '}
                                      now
                                    </p>
                                  </div>

                                  {paymentType ===
                                    'full' && (
                                    <span className="text-court">
                                      ✓
                                    </span>
                                  )}
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setPaymentType(
                                    'deposit'
                                  )
                                }
                                className={
                                  'w-full rounded-xl border p-4 text-left transition-colors ' +
                                  (paymentType ===
                                  'deposit'
                                    ? 'border-court bg-court/10'
                                    : 'border-line bg-paper')
                                }
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-ink">
                                      Deposit
                                    </p>

                                    <p className="mt-1 text-xs text-muted">
                                      {
                                        settings?.deposit_percentage ??
                                        50
                                      }
                                      % deposit · ₱
                                      {Math.round(
                                        (getTotalPrice() *
                                          (settings?.deposit_percentage ??
                                            50)) /
                                          100
                                      )}
                                    </p>
                                  </div>

                                  {paymentType ===
                                    'deposit' && (
                                    <span className="text-court">
                                      ✓
                                    </span>
                                  )}
                                </div>
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                bookAsGuest &&
                                (!guestName.trim() ||
                                  !guestPhone.trim())
                              ) {
                                setError(
                                  'Please enter your name and phone number'
                                )
                                return
                              }

                              if (
                                !bookAsGuest &&
                                !user
                              ) {
                                navigate(
                                  '/login'
                                )
                                return
                              }

                              setError('')
                              setCustomerDetailsOpen(
                                false
                              )
                              setModalStep(
                                'rules'
                              )
                            }}
                            className="btn-court w-full rounded-xl px-5 py-3.5 text-sm font-semibold"
                          >
                            Continue →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
          </main>

          {/* DESKTOP SUMMARY */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">

                <div className="border-b border-line p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-court">
                    Booking summary
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-ink">
                    {court?.name ??
                      'Select a court'}
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    {formatDateLong(date)}
                  </p>
                </div>

                <div className="p-5">
                  {!court ? (
                    <div className="rounded-xl border border-dashed border-line bg-paper px-4 py-8 text-center">
                      <p className="text-sm font-medium text-ink">
                        No court selected
                      </p>
                    </div>
                  ) : selectedSlots.length ===
                    0 ? (
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
                        {selectedGroups.map(
                          (group) => (
                            <div
                              key={`${group.start}-${group.end}`}
                              className="rounded-xl border border-line bg-paper p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-ink">
                                    {formatTime(
                                      group.start
                                    )}{' '}
                                    –{' '}
                                    {formatTime(
                                      group.end
                                    )}
                                  </p>

                                  <p className="mt-0.5 text-xs text-muted">
                                    {group.hours}{' '}
                                    hour
                                    {group.hours >
                                    1
                                      ? 's'
                                      : ''}
                                    {group.isSeparate
                                      ? ' · Separate slot'
                                      : ''}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const groupSlots =
                                      selectedSlots.filter(
                                        (slot) =>
                                          slot.start_time >=
                                            group.start &&
                                          slot.end_time <=
                                            group.end
                                      )

                                    groupSlots.forEach(
                                      (
                                        slot
                                      ) =>
                                        removeSlot(
                                          slot.start_time
                                        )
                                    )
                                  }}
                                  className="text-xs text-muted hover:text-red-400"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      <div className="my-5 border-t border-line" />

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted">
                            Hours
                          </span>

                          <span className="font-medium text-ink">
                            {
                              selectedSlots.length
                            }
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-muted">
                            Rate
                          </span>

                          <span className="font-medium text-ink">
                            ₱
                            {
                              court.price_per_hour
                            }{' '}
                            / hr
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-muted">
                            Payment
                          </span>

                          <span className="font-medium capitalize text-ink">
                            {paymentType}
                          </span>
                        </div>
                      </div>

                      <div className="my-5 border-t border-line" />

                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs text-muted">
                            Total
                          </p>

                          <p className="mt-1 font-display text-3xl font-semibold text-ink">
                            ₱
                            {getTotalPrice()}
                          </p>
                        </div>

                        {paymentType ===
                          'deposit' && (
                          <div className="text-right">
                            <p className="text-xs text-muted">
                              Due now
                            </p>

                            <p className="font-semibold text-court">
                              ₱
                              {getAmountDue()}
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={
                          openRulesModal
                        }
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

      {/* MOBILE STICKY SUMMARY */}
      {selectedSlots.length > 0 &&
        court && (
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
                        `${formatTime(
                          group.start
                        )}–${formatTime(
                          group.end
                        )}`
                    )
                    .join(' · ')}
                </p>

                <p className="text-xs text-muted">
                  {selectedSlots.length}{' '}
                  hr
                  {selectedSlots.length >
                  1
                    ? 's'
                    : ''}{' '}
                  · ₱
                  {getTotalPrice()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError('')
                  setCustomerDetailsOpen(
                    true
                  )
                }}
                className="btn-court shrink-0 rounded-xl px-5 py-3 text-sm font-semibold"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

      {/* RULES MODAL */}
      {modalStep === 'rules' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-line bg-surface">
            <div className="border-b border-line p-6">
              <h2 className="font-display text-xl font-semibold text-ink">
                Booking rules
              </h2>

              <p className="mt-1 text-sm text-muted">
                Please review these rules before continuing.
              </p>
            </div>

            <div className="p-6">
              <ol className="mb-6 list-inside list-decimal space-y-3 text-sm text-muted">
                {BOOKING_RULES.map(
                  (rule, index) => (
                    <li key={index}>
                      {rule}
                    </li>
                  )
                )}
              </ol>

              <label className="mb-6 flex cursor-pointer items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={
                    agreedToRules
                  }
                  onChange={(e) =>
                    setAgreedToRules(
                      e.target.checked
                    )
                  }
                  className="mt-0.5"
                />

                <span>
                  I have read and agree to the booking rules.
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalStep(
                      'none'
                    )
                    setError('')
                  }}
                  className="flex-1 rounded-md border border-line px-4 py-2 font-medium text-ink transition-colors hover:border-court"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={
                    proceedToPayment
                  }
                  disabled={
                    !agreedToRules
                  }
                  className="btn-court flex-1 rounded-md px-4 py-2 font-medium transition-colors disabled:opacity-40"
                >
                  Continue to payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {modalStep === 'payment' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-line bg-surface">
            <div className="border-b border-line p-6">
              <h2 className="font-display text-xl font-semibold text-ink">
                Complete payment
              </h2>

              <p className="mt-1 text-sm text-muted">
                Pay ₱
                {getAmountDue()} via GCash, then upload your payment screenshot.
              </p>
            </div>

            <div className="p-6">
              {error && (
                <p className="mb-4 text-sm text-red-400">
                  {error}
                </p>
              )}

              {settings?.gcash_qr_url && (
                <img
                  src={
                    settings.gcash_qr_url
                  }
                  alt="GCash QR"
                  className="mx-auto mb-4 h-40 w-40 rounded-lg border border-line bg-white object-contain"
                />
              )}

              {(settings?.gcash_number ||
                settings?.gcash_name) && (
                <div className="mb-4 space-y-1 text-sm text-ink">
                  {settings.gcash_name && (
                    <p>
                      Account name:{' '}
                      <span className="font-medium">
                        {
                          settings.gcash_name
                        }
                      </span>
                    </p>
                  )}

                  {settings.gcash_number && (
                    <p>
                      GCash number:{' '}
                      <span className="font-medium">
                        {
                          settings.gcash_number
                        }
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-muted">
                  Upload payment screenshot
                </label>

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-paper px-4 py-6 transition-colors hover:border-court">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setProofFile(
                        e.target.files?.[0] ??
                          null
                      )
                    }
                    className="hidden"
                  />

                  <span className="text-center text-sm text-muted">
                    {proofFile ? (
                      <span className="font-medium text-ink">
                        {
                          proofFile.name
                        }
                      </span>
                    ) : (
                      <>
                        <span className="font-medium text-court">
                          Tap to upload
                        </span>{' '}
                        a screenshot
                      </>
                    )}
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalStep(
                      'rules'
                    )
                    setError('')
                  }}
                  className="flex-1 rounded-md border border-line px-4 py-2 font-medium text-ink transition-colors hover:border-court"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={
                    handleSubmitBooking
                  }
                  disabled={
                    !proofFile ||
                    submitting
                  }
                  className="btn-court flex-1 rounded-md px-4 py-2 font-medium transition-colors disabled:opacity-40"
                >
                  {submitting
                    ? 'Submitting...'
                    : 'Confirm booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {modalStep === 'success' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-court/15 text-2xl text-court">
              ✓
            </div>

            <h2 className="mb-2 font-display text-xl font-semibold text-ink">
              Booking submitted
            </h2>

            <p className="mb-1 text-sm text-muted">
              Your payment proof has been sent for verification. You'll be notified once confirmed.
            </p>

            <div className="my-4 rounded-lg border border-line bg-paper px-4 py-3">
              <p className="mb-1 text-xs text-muted">
                Booking reference
              </p>

              <p className="font-display text-lg font-semibold tracking-wide text-court">
                {bookingReference}
              </p>
            </div>

            <p className="mb-6 text-xs text-muted">
              Save this reference to look up your booking later.
            </p>

            <button
              type="button"
              onClick={
                closeModals
              }
              className="btn-court w-full rounded-md px-6 py-2 font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}