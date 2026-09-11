import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Court, Settings } from '../../types/court'
import type { TimeSlot } from '../../types/availability'
import {
  getCourts,
  getSettings,
} from '../../services/courtService'
import {
  getAvailableSlots,
  createReservation,
  generateBookingReference,
} from '../../services/availabilityService'
import {
  searchCustomers,
  type CustomerProfile,
} from '../../services/customerService'

function formatDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`)

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`)

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(time: string) {
  if (!time) return ''

  const [hourString, minuteString] = time.split(':')
  const hour = Number(hourString)
  const minute = minuteString ?? '00'

  if (hour === 24) {
    return `12:${minute} AM`
  }

  const normalizedHour = hour % 24
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM'
  const displayHour = normalizedHour % 12 || 12

  return `${displayHour}:${minute} ${suffix}`
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)

  return formatDate(date)
}

function StepHeader({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-court text-sm font-bold text-white shadow-sm">
        {number}
      </div>

      <div className="min-w-0">
        <h2 className="text-sm font-bold text-ink sm:text-base">
          {title}
        </h2>

        <p className="mt-0.5 text-xs leading-5 text-muted">
          {description}
        </p>
      </div>
    </div>
  )
}

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`pr-card overflow-hidden ${className}`}
    >
      {children}
    </section>
  )
}

export default function CreateBooking() {
  const navigate = useNavigate()

  const [courts, setCourts] = useState<Court[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)

  const [selectedCourtId, setSelectedCourtId] = useState('')
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])

  const [customerType, setCustomerType] =
    useState<'guest' | 'registered'>('guest')

  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerProfile[]>([])
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerProfile | null>(null)
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  const [paymentType, setPaymentType] =
    useState<'full' | 'deposit'>('full')

  const [loading, setLoading] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')
  const [successReference, setSuccessReference] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (!selectedCourtId || !selectedDate) return

    loadSlots()
  }, [selectedCourtId, selectedDate])

  useEffect(() => {
    if (customerType !== 'registered') {
      setCustomerResults([])
      setSearchingCustomers(false)
      return
    }

    const term = customerSearch.trim()

    if (!term) {
      setCustomerResults([])
      setSearchingCustomers(false)
      return
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSearchingCustomers(true)

        const results = await searchCustomers(term)

        setCustomerResults(results)
      } catch (err) {
        console.error(err)
        setCustomerResults([])
      } finally {
        setSearchingCustomers(false)
      }
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [customerSearch, customerType])

  async function loadInitialData() {
    try {
      setLoading(true)
      setError('')

      const [courtsData, settingsData] =
        await Promise.all([
          getCourts(),
          getSettings(),
        ])

      setCourts(courtsData)
      setSettings(settingsData)

      const firstAvailable = courtsData.find(
        (court: Court) => court.status === 'available'
      )

      if (firstAvailable) {
        setSelectedCourtId(firstAvailable.id)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load booking data.')
    } finally {
      setLoading(false)
    }
  }

  async function loadSlots() {
    try {
      setLoadingSlots(true)
      setError('')
      setSelectedSlots([])

      const data = await getAvailableSlots(
        selectedCourtId,
        selectedDate
      )

      setSlots(data)
    } catch (err) {
      console.error(err)
      setError('Failed to load available time slots.')
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  const selectedCourt = useMemo(
    () =>
      courts.find(
        (court) => court.id === selectedCourtId
      ),
    [courts, selectedCourtId]
  )

  const isWeekend = useMemo(() => {
    const date = new Date(
      `${selectedDate}T00:00:00`
    )

    const day = date.getDay()

    return day === 0 || day === 6
  }, [selectedDate])

  const hourlyRate = useMemo(() => {
    if (!selectedCourt) return 0

    if (
      isWeekend &&
      selectedCourt.weekend_pricing_enabled &&
      selectedCourt.weekend_price_per_hour
    ) {
      return Number(
        selectedCourt.weekend_price_per_hour
      )
    }

    return Number(selectedCourt.price_per_hour)
  }, [selectedCourt, isWeekend])

  const totalAmount = useMemo(() => {
    return selectedSlots.length * hourlyRate
  }, [selectedSlots, hourlyRate])

  const depositAmount = useMemo(() => {
    const percentage = Number(
      settings?.deposit_percentage ?? 50
    )

    return totalAmount * (percentage / 100)
  }, [settings, totalAmount])

  const amountDue =
    paymentType === 'deposit'
      ? depositAmount
      : totalAmount

  function toggleCustomerType(
    type: 'guest' | 'registered'
  ) {
    setCustomerType(type)
    setError('')

    setGuestName('')
    setGuestPhone('')

    setCustomerSearch('')
    setCustomerResults([])
    setSelectedCustomer(null)
  }

  function selectCustomer(customer: CustomerProfile) {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.username)
    setCustomerResults([])
    setError('')
  }

  function toggleSlot(slot: TimeSlot) {
    if (!slot.available) return

    setSelectedSlots((current) => {
      if (current.includes(slot.start_time)) {
        return current.filter(
          (time) => time !== slot.start_time
        )
      }

      return [
        ...current,
        slot.start_time,
      ].sort((a, b) => a.localeCompare(b))
    })
  }

  function selectDuration(
    duration: 'one' | 'six' | 'full'
  ) {
    const availableSlots = slots.filter(
      (slot) => slot.available
    )

    if (duration === 'one') {
      setSelectedSlots(
        availableSlots.length > 0
          ? [availableSlots[0].start_time]
          : []
      )

      return
    }

    if (duration === 'six') {
      setSelectedSlots(
        availableSlots
          .slice(0, 6)
          .map((slot) => slot.start_time)
      )

      return
    }

    setSelectedSlots(
      availableSlots.map(
        (slot) => slot.start_time
      )
    )
  }

  function validateBooking() {
    if (!selectedCourtId) {
      setError('Please select a court.')
      return false
    }

    if (!selectedDate) {
      setError('Please select a date.')
      return false
    }

    if (selectedSlots.length === 0) {
      setError('Please select at least one time slot.')
      return false
    }

    if (customerType === 'guest') {
      if (!guestName.trim()) {
        setError('Please enter the guest name.')
        return false
      }

      if (!guestPhone.trim()) {
        setError('Please enter the guest phone number.')
        return false
      }
    }

    if (
      customerType === 'registered' &&
      !selectedCustomer
    ) {
      setError('Please select a registered customer.')
      return false
    }

    return true
  }

  async function handleCreateBooking() {
    if (!validateBooking()) return

    try {
      setSubmitting(true)
      setError('')

      const latestSlots =
        await getAvailableSlots(
          selectedCourtId,
          selectedDate
        )

      for (const selectedTime of selectedSlots) {
        const latestSlot = latestSlots.find(
          (slot) =>
            slot.start_time === selectedTime
        )

        if (!latestSlot?.available) {
          throw new Error(
            `The ${formatTime(selectedTime)} slot is no longer available.`
          )
        }
      }

      const bookingReference =
        await generateBookingReference()

      const sortedSlots = [...selectedSlots].sort(
        (a, b) => a.localeCompare(b)
      )

      for (const startTime of sortedSlots) {
        const slot = latestSlots.find(
          (item) =>
            item.start_time === startTime
        )

        if (!slot || !slot.available) {
          throw new Error(
            'One or more selected slots are no longer available.'
          )
        }

        await createReservation({
          court_id: selectedCourtId,

          user_id:
            customerType === 'registered'
              ? selectedCustomer?.id ?? null
              : null,

          guest_name:
            customerType === 'guest'
              ? guestName.trim()
              : null,

          guest_phone:
            customerType === 'guest'
              ? guestPhone.trim()
              : null,

          date: selectedDate,
          start_time: slot.start_time,
          end_time: slot.end_time,

          status: 'confirmed',

          payment_type: paymentType,

          payment_status: 'verified',

          amount_due:
            paymentType === 'deposit'
              ? depositAmount
              : hourlyRate,

          payment_proof_url: null,

          booking_reference:
            bookingReference,
        })
      }

      setSuccessReference(bookingReference)
      setSelectedSlots([])
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create booking.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  function closeSuccess() {
    setSuccessReference('')
    navigate('/admin/reservations')
  }

  const customerDisplayName =
    customerType === 'registered'
      ? selectedCustomer?.username ?? 'No customer selected'
      : guestName.trim() || 'Guest / Walk-in'

  const selectedSlotObjects = useMemo(() => {
    return [...selectedSlots]
      .sort((a, b) => a.localeCompare(b))
      .map((time) => {
        const slot = slots.find(
          (item) => item.start_time === time
        )

        return {
          time,
          slot,
        }
      })
  }, [selectedSlots, slots])

  if (loading) {
    return (
      <div className="pr-page min-h-[500px]">
        <div className="mx-auto flex min-h-[500px] max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-line border-t-court" />
            <p className="text-sm font-medium text-muted">
              Loading booking system...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pr-page min-h-[calc(100vh-64px)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* HEADER */}
        <div className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
                <span>Admin</span>
                <span>/</span>
                <span className="text-court">
                  Create Booking
                </span>
              </div>

              <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Create Booking
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-muted">
                Create a reservation for a walk-in,
                guest, or registered customer.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate('/admin/reservations')
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-court/30 hover:bg-paper"
            >
              <span className="text-base">←</span>
              Back to Reservations
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold">
              !
            </div>

            <div className="flex-1 pt-0.5">
              {error}
            </div>

            <button
              type="button"
              onClick={() => setError('')}
              className="rounded-lg px-2 text-lg leading-none text-red-500 transition hover:bg-red-100 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* PROGRESS */}
        <div className="pr-card mb-6 hidden overflow-hidden sm:block">
          <div className="grid grid-cols-5 divide-x divide-line">
            {[
              ['1', 'Court'],
              ['2', 'Date'],
              ['3', 'Time'],
              ['4', 'Customer'],
              ['5', 'Payment'],
            ].map(([number, label]) => (
              <div
                key={number}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-court/10 text-xs font-bold text-court">
                  {number}
                </div>

                <span className="text-xs font-semibold text-muted">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">

          {/* MAIN */}
          <div className="space-y-5">

            {/* COURT */}
            <SectionCard>
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <StepHeader
                  number={1}
                  title="Select Court"
                  description="Choose the court for this reservation."
                />
              </div>

              <div className="p-5 sm:p-6">
                {courts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line bg-paper px-4 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                      🏓
                    </div>

                    <p className="text-sm font-semibold text-ink">
                      No courts found
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      Add a court before creating a booking.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {courts.map((court: Court) => {
                      const selected =
                        court.id === selectedCourtId

                      const available =
                        court.status === 'available'

                      const displayRate =
                        isWeekend &&
                        court.weekend_pricing_enabled &&
                        court.weekend_price_per_hour
                          ? Number(court.weekend_price_per_hour)
                          : Number(court.price_per_hour)

                      return (
                        <button
                          key={court.id}
                          type="button"
                          disabled={!available}
                          onClick={() => {
                            setSelectedCourtId(court.id)
                            setError('')
                          }}
                          className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                            selected
                              ? 'border-court bg-court/[0.04] ring-2 ring-court/15'
                              : available
                                ? 'border-line bg-white hover:-translate-y-0.5 hover:border-court/40 hover:shadow-sm'
                                : 'cursor-not-allowed border-line bg-paper opacity-60'
                          }`}
                        >
                          {selected && (
                            <div className="absolute right-0 top-0 rounded-bl-xl bg-court px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Selected
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg transition ${
                                  selected
                                    ? 'bg-court text-white'
                                    : 'bg-paper text-court group-hover:bg-court/10'
                                }`}
                              >
                                🏓
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold text-ink">
                                  {court.name}
                                </p>

                                {settings?.show_court_type &&
                                  court.type && (
                                    <p className="mt-0.5 text-xs text-muted">
                                      {court.type}
                                    </p>
                                  )}
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                available
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {available
                                ? 'Available'
                                : court.status}
                            </span>
                          </div>

                          <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                                Hourly rate
                              </p>

                              <p className="mt-1 text-base font-bold text-ink">
                                ₱{displayRate.toLocaleString()}
                                <span className="ml-1 text-xs font-normal text-muted">
                                  / hour
                                </span>
                              </p>
                            </div>

                            {court.is_24_hours && (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                                24 Hours
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* DATE */}
            <SectionCard>
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <StepHeader
                  number={2}
                  title="Select Play Date"
                  description="Choose when the customer will play."
                />
              </div>

              <div className="p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-[230px_minmax(0,1fr)] sm:items-center">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted">
                      Play date
                    </label>

                    <input
                      type="date"
                      value={selectedDate}
                      min={formatDate(new Date())}
                      max={addDays(
                        formatDate(new Date()),
                        Number(
                          settings?.booking_horizon_days ?? 60
                        )
                      )}
                      onChange={(event) => {
                        setSelectedDate(event.target.value)
                        setSelectedSlots([])
                      }}
                      className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-court focus:ring-2 focus:ring-court/10"
                    />
                  </div>

                  <div className="rounded-2xl border border-line bg-paper px-4 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                      Selected date
                    </p>

                    <p className="mt-1 text-sm font-bold text-ink sm:text-base">
                      {formatDisplayDate(selectedDate)}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      {isWeekend
                        ? 'Weekend pricing may apply.'
                        : 'Regular weekday pricing.'}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* TIME */}
            <SectionCard>
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <StepHeader
                    number={3}
                    title="Select Time Slots"
                    description="Choose one or multiple available hours."
                  />

                  {selectedSlots.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSlots([])
                      }
                      className="self-start rounded-lg px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50 hover:text-red-700"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="mb-5 rounded-2xl border border-line bg-paper p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                        Quick select
                      </p>

                      <p className="mt-1 text-xs text-muted">
                        Select a common booking duration.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        ['one', '1 Hour'],
                        ['six', '6 Hours'],
                        ['full', 'Full Day'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            selectDuration(
                              value as 'one' | 'six' | 'full'
                            )
                          }
                          className="rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink shadow-sm transition hover:border-court/40 hover:bg-court/5 hover:text-court"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* LEGEND */}
                <div className="mb-4 rounded-xl border border-line bg-white px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-white ring-1 ring-line" />
                      Available
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-court" />
                      Selected
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                      Booked
                    </div>
                  </div>
                </div>

                {loadingSlots ? (
                  <div className="rounded-2xl bg-paper py-14 text-center">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-court" />
                    <p className="text-sm font-medium text-muted">
                      Loading available slots...
                    </p>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line bg-paper px-4 py-12 text-center">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                      🕐
                    </div>

                    <p className="text-sm font-bold text-ink">
                      No time slots available
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      There are no bookable slots for this date.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                    {slots.map((slot: TimeSlot) => {
                      const selected =
                        selectedSlots.includes(
                          slot.start_time
                        )

                      const booked = !slot.available

                      return (
                        <button
                          key={`${slot.start_time}-${slot.end_time}`}
                          type="button"
                          disabled={booked}
                          onClick={() =>
                            toggleSlot(slot)
                          }
                          className={`rounded-xl border px-3.5 py-3 text-left transition ${
                            booked
                              ? 'cursor-not-allowed border-line bg-paper'
                              : selected
                                ? 'border-court bg-court text-white shadow-sm'
                                : 'border-line bg-white hover:-translate-y-0.5 hover:border-court/40 hover:bg-paper hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-sm font-bold ${
                                booked
                                  ? 'text-gray-400'
                                  : selected
                                    ? 'text-white'
                                    : 'text-ink'
                              }`}
                            >
                              {formatTime(
                                slot.start_time
                              )}
                            </span>

                            {selected && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-xs">
                                ✓
                              </span>
                            )}
                          </div>

                          <p
                            className={`mt-1 text-[10px] font-medium ${
                              booked
                                ? 'text-gray-400'
                                : selected
                                  ? 'text-white/70'
                                  : 'text-muted'
                            }`}
                          >
                            {booked
                              ? 'Booked'
                              : `until ${formatTime(
                                  slot.end_time
                                )}`}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}

                {selectedSlots.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-court/15 bg-court/[0.05] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold text-court">
                        {selectedSlots.length}{' '}
                        {selectedSlots.length === 1
                          ? 'hour'
                          : 'hours'}{' '}
                        selected
                      </p>

                      <p className="mt-1 text-[11px] text-muted">
                        Current total: ₱
                        {totalAmount.toLocaleString()}
                      </p>
                    </div>

                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Ready
                    </span>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* CUSTOMER */}
            <SectionCard>
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <StepHeader
                  number={4}
                  title="Customer"
                  description="Choose who the reservation is for."
                />
              </div>

              <div className="p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      toggleCustomerType('guest')
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      customerType === 'guest'
                        ? 'border-court bg-court/[0.04] ring-2 ring-court/10'
                        : 'border-line hover:border-court/30 hover:bg-paper'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            customerType === 'guest'
                              ? 'bg-court text-white'
                              : 'bg-paper text-court'
                          }`}
                        >
                          👤
                        </div>

                        <div>
                          <p className="text-sm font-bold text-ink">
                            Guest / Walk-in
                          </p>

                          <p className="mt-0.5 text-xs text-muted">
                            No registered account
                          </p>
                        </div>
                      </div>

                      {customerType === 'guest' && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-court/10 text-xs font-bold text-court">
                          ✓
                        </span>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      toggleCustomerType('registered')
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      customerType === 'registered'
                        ? 'border-court bg-court/[0.04] ring-2 ring-court/10'
                        : 'border-line hover:border-court/30 hover:bg-paper'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            customerType === 'registered'
                              ? 'bg-court text-white'
                              : 'bg-paper text-court'
                          }`}
                        >
                          🔐
                        </div>

                        <div>
                          <p className="text-sm font-bold text-ink">
                            Registered Customer
                          </p>

                          <p className="mt-0.5 text-xs text-muted">
                            Existing customer account
                          </p>
                        </div>
                      </div>

                      {customerType === 'registered' && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-court/10 text-xs font-bold text-court">
                          ✓
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                {/* GUEST */}
                {customerType === 'guest' && (
                  <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
                    <div className="mb-4">
                      <p className="text-xs font-bold text-ink">
                        Guest information
                      </p>

                      <p className="mt-1 text-[11px] text-muted">
                        Enter the customer's contact details.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted">
                          Customer Name
                        </label>

                        <input
                          type="text"
                          value={guestName}
                          onChange={(event) =>
                            setGuestName(
                              event.target.value
                            )
                          }
                          placeholder="Juan Dela Cruz"
                          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-court focus:ring-2 focus:ring-court/10"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted">
                          Phone Number
                        </label>

                        <input
                          type="tel"
                          value={guestPhone}
                          onChange={(event) =>
                            setGuestPhone(
                              event.target.value
                            )
                          }
                          placeholder="09XXXXXXXXX"
                          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-court focus:ring-2 focus:ring-court/10"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* REGISTERED */}
                {customerType === 'registered' && (
                  <div className="mt-5">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted">
                      Search Customer Username
                    </label>

                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          value={customerSearch}
                          onChange={(event) => {
                            setCustomerSearch(
                              event.target.value
                            )
                            setSelectedCustomer(null)
                          }}
                          placeholder="Type username..."
                          className="w-full rounded-xl border border-line bg-white px-4 py-3 pr-11 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-court focus:ring-2 focus:ring-court/10"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">
                          {searchingCustomers
                            ? '…'
                            : '⌕'}
                        </span>
                      </div>

                      {searchingCustomers && (
                        <p className="mt-2 text-xs text-muted">
                          Searching customers...
                        </p>
                      )}

                      {!searchingCustomers &&
                        customerSearch.trim() &&
                        !selectedCustomer &&
                        customerResults.length === 0 && (
                          <div className="mt-2 rounded-xl border border-line bg-paper px-4 py-3 text-xs text-muted">
                            No registered customer found.
                          </div>
                        )}

                      {customerResults.length > 0 &&
                        !selectedCustomer && (
                          <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
                            {customerResults.map(
                              (customer) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() =>
                                    selectCustomer(
                                      customer
                                    )
                                  }
                                  className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3.5 text-left transition last:border-b-0 hover:bg-paper"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-court/10 text-xs font-bold text-court">
                                      {customer.username
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>

                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-bold text-ink">
                                        {customer.username}
                                      </p>

                                      <p className="mt-0.5 text-[11px] text-muted">
                                        Registered customer
                                      </p>
                                    </div>
                                  </div>

                                  <span className="shrink-0 text-xs font-bold text-court">
                                    Select →
                                  </span>
                                </button>
                              )
                            )}
                          </div>
                        )}
                    </div>

                    {selectedCustomer && (
                      <div className="mt-4 flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                            {selectedCustomer.username
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-green-600">
                              Selected Customer
                            </p>

                            <p className="mt-0.5 truncate text-sm font-bold text-green-900">
                              {selectedCustomer.username}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(null)
                            setCustomerSearch('')
                            setCustomerResults([])
                          }}
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-100 hover:text-red-700"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* PAYMENT */}
            <SectionCard>
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <StepHeader
                  number={5}
                  title="Payment"
                  description="Select how the customer will pay."
                />
              </div>

              <div className="p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentType('full')
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      paymentType === 'full'
                        ? 'border-court bg-court/[0.04] ring-2 ring-court/10'
                        : 'border-line hover:border-court/30 hover:bg-paper'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-ink">
                          Full Payment
                        </p>

                        <p className="mt-1 text-xs text-muted">
                          Pay the complete booking amount
                        </p>
                      </div>

                      {paymentType === 'full' && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-court/10 text-xs font-bold text-court">
                          ✓
                        </span>
                      )}
                    </div>

                    <p className="mt-5 text-xl font-bold text-ink">
                      ₱{totalAmount.toLocaleString()}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPaymentType('deposit')
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      paymentType === 'deposit'
                        ? 'border-court bg-court/[0.04] ring-2 ring-court/10'
                        : 'border-line hover:border-court/30 hover:bg-paper'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-ink">
                          Deposit
                        </p>

                        <p className="mt-1 text-xs text-muted">
                          {Number(
                            settings?.deposit_percentage ?? 50
                          )}
                          % deposit
                        </p>
                      </div>

                      {paymentType === 'deposit' && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-court/10 text-xs font-bold text-court">
                          ✓
                        </span>
                      )}
                    </div>

                    <p className="mt-5 text-xl font-bold text-ink">
                      ₱{depositAmount.toLocaleString()}
                    </p>
                  </button>
                </div>

                <div className="mt-4 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                    i
                  </span>

                  <p className="text-xs leading-5 text-blue-800">
                    Admin-created bookings are automatically
                    marked as <strong>verified</strong> and
                    confirmed immediately.
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* SUMMARY */}
          <aside>
            <div className="xl:sticky xl:top-5">
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">

                {/* SUMMARY HEADER */}
                <div className="bg-court px-5 py-5 text-white sm:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/65">
                        PickleReserve
                      </p>

                      <h2 className="mt-1 font-display text-lg font-bold">
                        Booking Summary
                      </h2>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                      🏓
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="space-y-5">

                    {/* CUSTOMER */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                        Customer
                      </p>

                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-bold text-court">
                          {customerDisplayName
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-ink">
                            {customerDisplayName}
                          </p>

                          <p className="mt-0.5 truncate text-[11px] text-muted">
                            {customerType === 'registered'
                              ? 'Registered customer'
                              : guestPhone.trim() ||
                                'Guest / Walk-in'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* COURT + DATE */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-line bg-paper p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                          Court
                        </p>

                        <p className="mt-1 truncate text-sm font-bold text-ink">
                          {selectedCourt?.name ?? '—'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-line bg-paper p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                          Date
                        </p>

                        <p className="mt-1 text-sm font-bold text-ink">
                          {formatShortDate(selectedDate)}
                        </p>
                      </div>
                    </div>

                    {/* TIME */}
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                          Selected Hours
                        </p>

                        {selectedSlots.length > 0 && (
                          <span className="rounded-full bg-court/10 px-2.5 py-1 text-[10px] font-bold text-court">
                            {selectedSlots.length}{' '}
                            {selectedSlots.length === 1
                              ? 'hour'
                              : 'hours'}
                          </span>
                        )}
                      </div>

                      {selectedSlots.length === 0 ? (
                        <div className="mt-2 rounded-xl border border-dashed border-line bg-paper px-3 py-5 text-center">
                          <p className="text-xs text-muted">
                            No time slots selected
                          </p>
                        </div>
                      ) : (
                        <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1">
                          {selectedSlotObjects.map(
                            ({ time, slot }) => (
                              <div
                                key={time}
                                className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5"
                              >
                                <span className="text-xs font-bold text-ink">
                                  {formatTime(time)}
                                </span>

                                <span className="text-[10px] font-medium text-muted">
                                  {slot
                                    ? formatTime(
                                        slot.end_time
                                      )
                                    : ''}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {/* PAYMENT */}
                    <div className="border-t border-dashed border-line pt-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">
                          Rate
                        </span>

                        <span className="font-semibold text-ink">
                          ₱{hourlyRate.toLocaleString()}/hr
                        </span>
                      </div>

                      <div className="mt-2 flex justify-between text-xs">
                        <span className="text-muted">
                          Duration
                        </span>

                        <span className="font-semibold text-ink">
                          {selectedSlots.length}{' '}
                          {selectedSlots.length === 1
                            ? 'hour'
                            : 'hours'}
                        </span>
                      </div>

                      <div className="mt-2 flex justify-between text-xs">
                        <span className="text-muted">
                          Payment
                        </span>

                        <span className="font-semibold capitalize text-ink">
                          {paymentType}
                        </span>
                      </div>
                    </div>

                    {/* TOTAL */}
                    <div className="rounded-2xl border border-line bg-paper p-4">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                            Total
                          </p>

                          <p className="mt-1 text-2xl font-bold text-ink">
                            ₱{totalAmount.toLocaleString()}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                            Amount due
                          </p>

                          <p className="mt-1 text-sm font-bold text-court">
                            ₱{amountDue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* CREATE */}
                    <button
                      type="button"
                      disabled={
                        submitting ||
                        loadingSlots ||
                        selectedSlots.length === 0
                      }
                      onClick={
                        handleCreateBooking
                      }
                      className="w-full rounded-xl bg-court px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {submitting
                        ? 'Creating Booking...'
                        : 'Create Booking'}
                    </button>

                    <p className="text-center text-[10px] leading-4 text-muted">
                      Booking will be confirmed immediately
                      after creation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* SUCCESS MODAL */}
      {successReference && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="bg-court px-6 py-7 text-center text-white">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-3xl">
                ✓
              </div>

              <h2 className="mt-4 font-display text-xl font-bold">
                Booking Created
              </h2>

              <p className="mt-1 text-sm text-white/70">
                Reservation confirmed successfully.
              </p>
            </div>

            <div className="p-6 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                Booking Reference
              </p>

              <div className="mt-2 rounded-2xl border border-dashed border-line bg-paper px-4 py-5">
                <p className="text-2xl font-bold tracking-wider text-ink">
                  {successReference}
                </p>
              </div>

              <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3">
                <p className="text-xs leading-5 text-blue-800">
                  Save this reference number for finding
                  the reservation later.
                </p>
              </div>

              <button
                type="button"
                onClick={closeSuccess}
                className="mt-5 w-full rounded-xl bg-court px-4 py-3 font-bold text-white transition hover:opacity-90"
              >
                View Reservations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}