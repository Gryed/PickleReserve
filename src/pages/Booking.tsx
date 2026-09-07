import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Court, Settings } from '../types/court'
import type { TimeSlot } from '../types/availability'
import { getCourts, getSettings } from '../services/courtService'
import { getAvailableSlots, createReservation } from '../services/availabilityService'
import { uploadPaymentProof, updateReservationPaymentProof } from '../services/paymentService'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Booking() {
  const { courtId } = useParams<{ courtId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [court, setCourt] = useState<Court | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([])
  const [paymentType, setPaymentType] = useState<'full' | 'deposit'>('full')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [reservationIds, setReservationIds] = useState<string[]>([])

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

  async function handleBook() {
    if (!user) {
      navigate('/login')
      return
    }
    if (!courtId || selectedSlots.length === 0) return

    setBooking(true)
    setError('')
    try {
      const amountPerSlot = getAmountDue() / selectedSlots.length

      const reservations = await Promise.all(
        selectedSlots.map((slot) =>
          createReservation({
            court_id: courtId,
            user_id: user.id,
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
    return <div className="p-8">Loading court...</div>
  }

  if (success) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-green-600 mb-2">Booking Submitted!</h1>
        <p className="text-gray-600">
          Your payment proof has been sent for verification. You'll be notified once confirmed.
        </p>
      </div>
    )
  }

  if (reservationIds.length > 0) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Complete Payment</h1>
        <p className="text-gray-500 mb-6">
          Pay ₱{getAmountDue()} via GCash, then upload your payment screenshot below.
        </p>

        {error && <p className="text-red-600 mb-4">{error}</p>}

        {settings?.gcash_qr_url && (
          <img
            src={settings.gcash_qr_url}
            alt="GCash QR"
            className="w-48 h-48 object-contain border rounded mb-4"
          />
        )}
        {settings?.gcash_number && (
          <p className="mb-6">
            GCash Number: <span className="font-medium">{settings.gcash_number}</span>
          </p>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Upload payment screenshot</label>
          <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
        </div>

        <button
          onClick={handleSubmitProof}
          disabled={!proofFile || booking}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {booking ? 'Submitting...' : 'Submit Payment Proof'}
        </button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{court.name}</h1>
      <p className="text-gray-500 mb-6">₱{court.price_per_hour}/hour</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Select date</label>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </div>

      {loading && <p>Loading available times...</p>}

      {!loading && slots.length === 0 && <p className="text-gray-500">Closed on this day.</p>}

      {!loading && slots.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-2">Select one or more time slots</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
            {slots.map((slot) => {
              const isSelected = selectedSlots.some((s) => s.start_time === slot.start_time)
              const btnClass = !slot.available
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                : isSelected
                ? 'bg-blue-600 text-white'
                : 'hover:bg-blue-50'

              return (
                <button
                  key={slot.start_time}
                  disabled={!slot.available}
                  onClick={() => toggleSlot(slot)}
                  className={'border rounded px-3 py-2 text-sm ' + btnClass}
                >
                  {slot.start_time.slice(0, 5)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedSlots.length > 0 && (
        <div>
          <div className="mb-4 text-sm text-gray-700">
            {selectedSlots.length} slot(s) selected · Total: ₱{getTotalPrice()}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Payment option</label>
            <div className="flex gap-3">
              <button
                onClick={() => setPaymentType('full')}
                className={
                  'border rounded px-4 py-2 text-sm ' +
                  (paymentType === 'full' ? 'bg-blue-600 text-white' : '')
                }
              >
                Full payment (₱{getTotalPrice()})
              </button>
              <button
                onClick={() => setPaymentType('deposit')}
                className={
                  'border rounded px-4 py-2 text-sm ' +
                  (paymentType === 'deposit' ? 'bg-blue-600 text-white' : '')
                }
              >
                Deposit ({settings?.deposit_percentage ?? 50}% — ₱
                {Math.round((getTotalPrice() * (settings?.deposit_percentage ?? 50)) / 100)})
              </button>
            </div>
          </div>

          <button
            onClick={handleBook}
            disabled={booking}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {booking ? 'Processing...' : user ? `Confirm ${selectedSlots.length} slot(s)` : 'Login to book'}
          </button>
        </div>
      )}
    </div>
  )
}