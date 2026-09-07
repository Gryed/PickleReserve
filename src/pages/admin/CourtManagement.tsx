import { useEffect, useState } from 'react'
import type { Court, Settings } from '../../types/court'
import {
  getCourts,
  createCourt,
  updateCourt,
  deleteCourt,
  getSettings,
  updateSettings,
} from '../../services/courtService'

export default function CourtManagement() {
  const [courts, setCourts] = useState<Court[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      const [courtsData, settingsData] = await Promise.all([getCourts(), getSettings()])
      setCourts(courtsData)
      setSettings(settingsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
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
        name,
        type: type || null,
        price_per_hour: parseFloat(price),
        status: 'available',
      })
      setName('')
      setType('')
      setPrice('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add court')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleStatus(court: Court) {
    const newStatus = court.status === 'available' ? 'maintenance' : 'available'
    try {
      await updateCourt(court.id, { status: newStatus })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this court?')) return
    try {
      await deleteCourt(id)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete court')
    }
  }

  async function handleToggleShowType() {
    if (!settings) return
    try {
      const updated = await updateSettings({ show_court_type: !settings.show_court_type })
      setSettings(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
    }
  }

  if (loading) return <div className="p-8 max-w-4xl mx-auto text-ink/60">Loading...</div>

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Court management</h1>

      {error && <p className="text-red-700 mb-4">{error}</p>}

      {settings && (
        <div className="border border-line rounded-lg p-4 mb-8 bg-white flex items-center justify-between">
          <div>
            <p className="font-medium text-ink">Show court type/surface to customers</p>
            <p className="text-sm text-ink/50">Toggle off to hide the type field from the public booking view</p>
          </div>
          <button
            onClick={handleToggleShowType}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
              settings.show_court_type ? 'bg-court' : 'bg-line'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.show_court_type ? 'translate-x-6' : ''
              }`}
            />
          </button>
        </div>
      )}

      <form
        onSubmit={handleAddCourt}
        className="bg-white border border-line rounded-lg p-4 mb-8 grid grid-cols-1 sm:grid-cols-4 gap-3"
      >
        <input
          type="text"
          placeholder="Court name (e.g. Court 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-line rounded-md px-3 py-2 focus:outline-none focus:border-court"
          required
        />
        <input
          type="text"
          placeholder="Type (e.g. Indoor)"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-line rounded-md px-3 py-2 focus:outline-none focus:border-court"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price/hour"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="border border-line rounded-md px-3 py-2 focus:outline-none focus:border-court"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-court text-paper rounded-md px-4 py-2 font-medium hover:bg-court-dark transition-colors disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add court'}
        </button>
      </form>

      <div className="space-y-2">
        {courts.length === 0 && <p className="text-ink/50">No courts yet.</p>}
        {courts.map((court) => (
          <div key={court.id} className="border border-line rounded-lg p-4 bg-white flex items-center justify-between">
            <div>
              <p className="font-medium text-ink">{court.name}</p>
              <p className="text-sm text-ink/50">
                {court.type && `${court.type} · `}₱{court.price_per_hour}/hr
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  court.status === 'available'
                    ? 'bg-ball/30 text-court-dark'
                    : 'bg-line text-ink/60'
                }`}
              >
                {court.status}
              </span>
              <button
                onClick={() => handleToggleStatus(court)}
                className="text-sm text-court hover:underline"
              >
                Toggle status
              </button>
              <button
                onClick={() => handleDelete(court.id)}
                className="text-sm text-red-700 hover:underline"
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