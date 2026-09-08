import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Court, Settings } from '../types/court'
import type { TimeSlot } from '../types/availability'
import { getCourts, getSettings } from '../services/courtService'
import { getAvailableSlots, createReservation } from '../services/availabilityService'
import { uploadPaymentProof, updateReservationPaymentProof } from '../services/paymentService'
import { supabase } from '../lib/supabase'
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
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [agreedToRules, setAgreedToRules] = useState(false)

  const [bookAsGuest, setBookAsGuest] = useState(!user)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [reservationIds, setReservationIds] = useState<string[]>([])

  const dateOptions = nextDays(14)

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
      if (exists) {
        return prev.filter((s) => s.start_time !== slot.start_time)
      }
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
    setShowRulesModal(true)
  }

  async function handleBook() {
    if (!courtId || selectedSlots.length === 0 || !agreedToRules) return

    setBooking(true)
    setError('')
    try {
      const amountPerSlot = getAmountDue() / selectedSlots.length

      const reservations = await Promise.all(
        selectedSlots.map((slot) =>
          createReservation({
            court_id: courtId,
            user_id: bookAsGuest ? null : user!.id,
            guest_name: bookAsGuest ? guestName.trim() : null,
            guest_phone: bookAsGuest ? guestPhone.trim() : null,
            date,
            start_time: slot.start_time,
            end_time: slot.end_time,
          })
        )
      )

      await Promise.all(
        reservations.map((r) =>
          supabase
            .from('reservations')
            .update({ payment_type: paymentType, amount_due: amountPerSlot })
            .eq('id', r.id)
        )
      )

      setReservationIds(reservations.map((r) => r.id))
      setShowRulesModal(false)
      setBooking(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book')
      setBooking(false)
    }
  }

  async function handleSubmitProof() {
    if (reservationIds.length === 0 || !proofFile) return

    setBooking(true)
    setError('')
    try {
      const url = await uploadPaymentProof(proofFile, reservationIds[0])
      await Promise.all(reservationIds.map((id) => updateReservationPaymentProof(id, url)))
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit payment proof')
    } finally {
      setBooking(false)
    }
  }

  if (!court) {
    return <div className="p-8 max-w-2xl mx-auto text-muted">Loading court...</div>
  }

  if (success) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-court/15 text-court flex items-center justify-center mx-auto mb-4 text-2xl">
          ✓
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-2">Booking submitted</h1>
        <p className="text-muted">
          Your payment proof has been sent for verification. You'll be notified once confirmed.
        </p>
      </div>
    )
  }

  if (reservationIds.length > 0) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Complete payment</h1>
        <p className="text-muted mb-6">
          Pay ₱{getAmountDue()} via GCash, then upload your payment screenshot below.
        </p>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        {settings?.gcash_qr_url && (
          <img
            src={settings.gcash_qr_url}
            alt="GCash QR"
            className="w-48 h-48 object-contain border border-line rounded-lg mb-4 bg-white"
          />
        )}
        {(settings?.gcash_number || settings?.gcash_name) && (
          <div className="mb-6 text-ink space-y-1">
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

        <div className="mb-4">
          <label className="block text-sm font-medium text-muted mb-2">Upload payment screenshot</label>
          <label className="flex items-center justify-center gap-2 border border-dashed border-line rounded-lg px-4 py-6 cursor-pointer hover:border-court transition-colors bg-surface">
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

        <button
          onClick={handleSubmitProof}
          disabled={!proofFile || booking}
          className="btn-court px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {booking ? 'Submitting...' : 'Submit payment proof'}
        </button>
      </div>
    )
  }

  const availableCount = slots.filter((s) => s.available).length
  const bookedCount = slots.filter((s) => !s.available).length
  const displayedSlots =
    slotFilter === 'available'
      ? slots.filter((s) => s.available)
      : slotFilter === 'booked'
      ? slots.filter((s) => !s.available)
      : slots

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto relative">
      <h1 className="font-display text-2xl font-semibold text-ink mb-1">{court.name}</h1>
      <p className="text-muted mb-6">₱{court.price_per_hour} / hour</p>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {/* Date strip */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-muted mb-2">Select play date</label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dateOptions.map((d) => {
            const iso = toISODate(d)
            const isSelected = iso === date
            const isToday = iso === toISODate(new Date())
            return (
              <button
                key={iso}
                onClick={() => setDate(iso)}
                className={
                  'shrink-0 w-16 rounded-lg border px-2 py-2 text-center transition-colors ' +
                  (isSelected ? 'btn-court border-court' : 'border-line text-ink hover:border-court')
                }
              >
                {isToday && (
                  <div
                    className={
                      'text-[10px] font-semibold rounded-full px-1 mb-0.5 ' +
                      (isSelected ? 'text-paper/70' : 'text-court')
                    }
                  >
                    TODAY
                  </div>
                )}
                <div className={'text-xs font-medium ' + (isSelected ? 'text-paper/70' : 'text-muted')}>
                  {WEEKDAY[d.getDay()]}
                </div>
                <div className="font-display text-lg font-semibold">{d.getDate()}</div>
                <div className={'text-xs ' + (isSelected ? 'text-paper/70' : 'text-muted')}>
                  {MONTH[d.getMonth()]}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {loading && <p className="text-muted">Loading available times...</p>}

      {!loading && slots.length === 0 && <p className="text-muted">Closed on this day.</p>}

      {!loading && slots.length > 0 && (
        <div>
          {/* Legend + filter */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-court inline-block" /> Available ({availableCount})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Booked ({bookedCount})
              </span>
            </div>

            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setSlotFilter('all')}
                className={
                  'px-3 py-1.5 rounded-full border transition-colors ' +
                  (slotFilter === 'all' ? 'btn-court border-court' : 'border-line text-muted hover:border-court')
                }
              >
                All slots ({slots.length})
              </button>
              <button
                onClick={() => setSlotFilter('available')}
                className={
                  'px-3 py-1.5 rounded-full border transition-colors ' +
                  (slotFilter === 'available' ? 'btn-court border-court' : 'border-line text-muted hover:border-court')
                }
              >
                Available ({availableCount})
              </button>
              <button
                onClick={() => setSlotFilter('booked')}
                className={
                  'px-3 py-1.5 rounded-full border transition-colors ' +
                  (slotFilter === 'booked' ? 'btn-court border-court' : 'border-line text-muted hover:border-court')
                }
              >
                Booked ({bookedCount})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {displayedSlots.map((slot) => {
              const isSelected = selectedSlots.some((s) => s.start_time === slot.start_time)
              const btnClass = !slot.available
                ? 'bg-red-950/40 text-red-400/60 cursor-not-allowed line-through border-red-900/50'
                : isSelected
                ? 'btn-court border-court'
                : 'border-line hover:border-court text-ink'

              return (
                <button
                  key={slot.start_time}
                  disabled={!slot.available}
                  onClick={() => toggleSlot(slot)}
                  className={'border rounded-md px-2 py-2 text-xs sm:text-sm transition-colors ' + btnClass}
                >
                  {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedSlots.length > 0 && (
        <div>
          {/* Booking summary card */}
          <div className="border border-line rounded-lg p-4 bg-surface mb-6">
            <p className="font-display font-semibold text-ink mb-3">Booking summary</p>

            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted">Date</span>
                <span className="text-ink font-medium">{formatDateLong(date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Court</span>
                <span className="text-ink font-medium">{court.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total hours</span>
                <span className="text-court font-medium">{selectedSlots.length}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Rate</span>
                <span className="text-ink font-medium">₱{court.price_per_hour}/hr</span>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 mt-1.5">
                <span className="text-muted">Total payment</span>
                <span className="text-court font-semibold">₱{getTotalPrice()}</span>
              </div>
            </div>

            <p className="text-xs text-muted mb-2">Selected slots ({selectedSlots.length})</p>
            <div className="flex flex-wrap gap-2">
              {selectedSlots.map((s) => (
                <span
                  key={s.start_time}
                  className="flex items-center gap-2 border border-court/50 text-court text-xs px-3 py-1.5 rounded-full"
                >
                  {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  <button onClick={() => removeSlot(s.start_time)} className="hover:text-red-400">
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          {user && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-muted mb-2">Book as</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setBookAsGuest(false)}
                  className={
                    'border rounded-md px-4 py-2 text-sm transition-colors ' +
                    (!bookAsGuest ? 'btn-court border-court' : 'border-line text-ink hover:border-court')
                  }
                >
                  My account
                </button>
                <button
                  onClick={() => setBookAsGuest(true)}
                  className={
                    'border rounded-md px-4 py-2 text-sm transition-colors ' +
                    (bookAsGuest ? 'btn-court border-court' : 'border-line text-ink hover:border-court')
                  }
                >
                  Guest
                </button>
              </div>
            </div>
          )}

          {bookAsGuest && (
            <div className="mb-4 space-y-2">
              <input
                type="text"
                placeholder="Full name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full bg-surface border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full bg-surface border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
              />
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-muted mb-2">Payment option</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentType('full')}
                className={
                  'border rounded-md px-4 py-2 text-sm transition-colors ' +
                  (paymentType === 'full' ? 'btn-court border-court' : 'border-line text-ink hover:border-court')
                }
              >
                Full payment (₱{getTotalPrice()})
              </button>
              <button
                onClick={() => setPaymentType('deposit')}
                className={
                  'border rounded-md px-4 py-2 text-sm transition-colors ' +
                  (paymentType === 'deposit' ? 'btn-court border-court' : 'border-line text-ink hover:border-court')
                }
              >
                Deposit ({settings?.deposit_percentage ?? 50}% — ₱
                {Math.round((getTotalPrice() * (settings?.deposit_percentage ?? 50)) / 100)})
              </button>
            </div>
          </div>

          <button
            onClick={openRulesModal}
            className="btn-court px-6 py-2 rounded-md font-medium transition-colors"
          >
            Confirm {selectedSlots.length} slot(s)
          </button>
        </div>
      )}

      {/* Booking rules modal */}
      {showRulesModal && (
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

              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="flex-1 border border-line text-ink px-4 py-2 rounded-md font-medium hover:border-court transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleBook}
                  disabled={!agreedToRules || booking}
                  className="flex-1 btn-court px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-40"
                >
                  {booking ? 'Processing...' : 'Continue to payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}