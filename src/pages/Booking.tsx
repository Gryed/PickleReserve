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

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto relative">
      <h1 className="font-display text-2xl font-semibold text-ink mb-1">{court.name}</h1>
      <p className="text-muted mb-6">₱{court.price_per_hour} / hour</p>

      {error && modalStep === 'none' && <p className="text-red-400 mb-4">{error}</p>}

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
          <div className="flex justify-end mb-3">
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
                Available only ({availableCount})
              </button>
              <button
                onClick={() => setSlotFilter('booked')}
                className={
                  'px-3 py-1.5 rounded-full border transition-colors ' +
                  (slotFilter === 'booked' ? 'btn-court border-court' : 'border-line text-muted hover:border-court')
                }
              >
                Booked only ({bookedCount})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {displayedSlots.map((slot) => {
              const isSelected = selectedSlots.some((s) => s.start_time === slot.start_time)
              const btnClass = !slot.available
                ? 'bg-red-950/30 text-red-400 border-transparent'
                : isSelected
                ? 'btn-court border-transparent'
                : 'bg-surface border-transparent hover:border hover:border-court text-ink'

              return (
                <button
                  key={slot.start_time}
                  disabled={!slot.available}
                  onClick={() => toggleSlot(slot)}
                  className={
                    'border rounded-lg px-3 py-3 text-sm transition-colors flex flex-col items-center justify-center gap-1 min-h-[64px] ' +
                    btnClass
                  }
                >
                  <span className={'font-medium ' + (!slot.available ? 'line-through' : '')}>
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </span>
                  {slot.bookedByName ? (
                    <span className="text-[10px] opacity-90 no-underline truncate max-w-full">
                      {slot.bookedByName}
                    </span>
                  ) : (
                    <span className="text-xs opacity-70">₱{court.price_per_hour}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted mb-6 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-surface border border-line inline-block" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-court inline-block" /> Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Booked
            </span>
          </div>
        </div>
      )}

      {selectedSlots.length > 0 && (
        <div className="pb-24">
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

          <div className="mb-4">
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
      )}

      {/* Sticky bottom booking bar */}
      {selectedSlots.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-line z-40">
          <div className="max-w-2xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted uppercase tracking-wide truncate">{court.name}</p>
              <p className="text-sm text-ink font-medium truncate">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' · '}
                {groupConsecutiveSlots(selectedSlots)
                  .map((g) => `${formatTime(g.start)}-${formatTime(g.end)}`)
                  .join(', ')}
              </p>
              <p className="text-xs text-muted">
                {selectedSlots.length} {groupConsecutiveSlots(selectedSlots).length > 1 ? 'separate ' : ''}hr
                {selectedSlots.length > 1 ? 's' : ''} · ₱{getTotalPrice()}
              </p>
            </div>
            <button
              onClick={openRulesModal}
              className="btn-court px-5 py-2.5 rounded-md font-medium transition-colors shrink-0 whitespace-nowrap"
            >
              Book Now →
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