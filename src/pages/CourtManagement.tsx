import { useEffect, useState } from 'react'
import type { Court, Settings } from '../types/court'
import {
  getCourts,
  createCourt,
  updateCourt,
  deleteCourt,
  getSettings,
  updateSettings,
} from '../services/courtService'

export default function CourtManagement() {
  const [courts, setCourts] = useState<Court[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const [courtsData, settingsData] = await Promise.all([
        getCourts(),
        getSettings(),
      ])

      setCourts(courtsData)
      setSettings(settingsData)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load data'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleAddCourt(e: React.FormEvent) {
    e.preventDefault()

    setError('')
    setSubmitting(true)

    try {
      await createCourt({
        name: name.trim(),
        type: type.trim() || null,
        price_per_hour: Number(price),
        status: 'available',

        // Weekend pricing defaults to OFF
        weekend_pricing_enabled: false,
        weekend_price_per_hour: null,
      })

      setName('')
      setType('')
      setPrice('')

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to add court'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleStatus(court: Court) {
    const newStatus =
      court.status === 'available'
        ? 'maintenance'
        : 'available'

    try {
      await updateCourt(court.id, {
        status: newStatus,
      })

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update status'
      )
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this court?')) return

    try {
      await deleteCourt(id)
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete court'
      )
    }
  }

  async function handleToggleShowType() {
    if (!settings) return

    try {
      const updated = await updateSettings({
        show_court_type: !settings.show_court_type,
      })

      setSettings(updated)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update settings'
      )
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        Loading...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold">
        Court Management
      </h1>

      {error && (
        <p className="mb-4 text-red-600">
          {error}
        </p>
      )}

      {/* Settings toggle */}
      {settings && (
        <div className="mb-8 flex items-center justify-between rounded-lg border bg-gray-50 p-4">
          <div>
            <p className="font-medium">
              Show court type/surface to customers
            </p>

            <p className="text-sm text-gray-500">
              Toggle off to hide the type field from the public booking view
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleShowType}
            className={`relative h-6 w-12 rounded-full transition-colors ${
              settings.show_court_type
                ? 'bg-blue-600'
                : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                settings.show_court_type
                  ? 'translate-x-6'
                  : ''
              }`}
            />
          </button>
        </div>
      )}

      {/* Add court form */}
      <form
        onSubmit={handleAddCourt}
        className="mb-8 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-4"
      >
        <input
          type="text"
          placeholder="Court name (e.g. Court 1)"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          className="rounded border px-3 py-2"
          required
        />

        <input
          type="text"
          placeholder="Type (e.g. Indoor)"
          value={type}
          onChange={(e) =>
            setType(e.target.value)
          }
          className="rounded border px-3 py-2"
        />

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Price/hour"
          value={price}
          onChange={(e) =>
            setPrice(e.target.value)
          }
          className="rounded border px-3 py-2"
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting
            ? 'Adding...'
            : 'Add Court'}
        </button>
      </form>

      {/* Courts list */}
      <div className="space-y-2">
        {courts.length === 0 && (
          <p className="text-gray-500">
            No courts yet.
          </p>
        )}

        {courts.map((court) => (
          <div
            key={court.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <p className="font-medium">
                {court.name}
              </p>

              <p className="text-sm text-gray-500">
                {court.type &&
                  `${court.type} · `}
                ₱{court.price_per_hour}/hr
              </p>

              {/* Weekend pricing status */}
              {court.weekend_pricing_enabled && (
                <p className="mt-1 text-xs font-medium text-blue-600">
                  Weekend: ₱
                  {court.weekend_price_per_hour ??
                    court.price_per_hour}
                  /hr
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  court.status === 'available'
                    ? 'bg-green-100 text-green-700'
                    : court.status === 'maintenance'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {court.status}
              </span>

              <button
                type="button"
                onClick={() =>
                  handleToggleStatus(court)
                }
                className="text-sm text-blue-600 hover:underline"
              >
                Toggle Status
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDelete(court.id)
                }
                className="text-sm text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}