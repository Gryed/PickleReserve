import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Court, Settings } from '../types/court'
import { getCourts, getSettings } from '../services/courtService'

export default function Home() {
  const [courts, setCourts] = useState<Court[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [courtsData, settingsData] = await Promise.all([getCourts(), getSettings()])
      setCourts(courtsData.filter((c) => c.status === 'available'))
      setSettings(settingsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courts')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8 max-w-4xl mx-auto text-ink/60">Loading courts...</div>
  if (error) return <div className="p-8 max-w-4xl mx-auto text-red-700">{error}</div>

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink mb-1">Book a court</h1>
        <p className="text-ink/60">Pick a court and reserve your time slot.</p>
      </div>

      {courts.length === 0 && (
        <div className="border border-line rounded-lg p-8 text-center text-ink/50">
          No courts available right now.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {courts.map((court) => (
          <Link
            key={court.id}
            to={`/booking/${court.id}`}
            className="group border border-line rounded-lg p-5 bg-white hover:border-court transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="font-display font-semibold text-lg text-ink">{court.name}</p>
              <span className="text-xs px-2 py-1 rounded-full bg-ball/30 text-court-dark font-medium">
                Available
              </span>
            </div>
            {settings?.show_court_type && court.type && (
              <p className="text-sm text-ink/50 mb-2">{court.type}</p>
            )}
            <p className="text-sm text-ink/70">
              <span className="font-semibold text-ink">₱{court.price_per_hour}</span> / hour
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}