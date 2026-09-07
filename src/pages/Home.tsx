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
      const [courtsData, settingsData] = await Promise.all([
        getCourts(),
        getSettings(),
      ])
      setCourts(courtsData.filter((c) => c.status === 'available'))
      setSettings(settingsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courts')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">PickleReserve — Available Courts</h1>

      {courts.length === 0 && <p className="text-gray-500">No courts available right now.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {courts.map((court) => (
          <Link
            key={court.id}
            to={`/booking/${court.id}`}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <p className="font-medium text-lg">{court.name}</p>
            {settings?.show_court_type && court.type && (
              <p className="text-sm text-gray-500">{court.type}</p>
            )}
            <p className="text-sm text-gray-700 mt-1">₱{court.price_per_hour}/hour</p>
          </Link>
        ))}
      </div>
    </div>
  )
}