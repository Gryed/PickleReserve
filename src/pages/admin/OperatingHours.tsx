import { useEffect, useState } from 'react'
import type { OperatingHours } from '../../types/availability'
import { getOperatingHours, updateOperatingHours } from '../../services/availabilityService'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function OperatingHoursPage() {
  const [hours, setHours] = useState<OperatingHours[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingDay, setSavingDay] = useState<number | null>(null)

  useEffect(() => {
    loadHours()
  }, [])

  async function loadHours() {
    try {
      setLoading(true)
      const data = await getOperatingHours()
      setHours(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load operating hours')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(
    dayOfWeek: number,
    field: 'open_time' | 'close_time' | 'is_closed',
    value: string | boolean
  ) {
    setSavingDay(dayOfWeek)
    setError('')
    try {
      const updated = await updateOperatingHours(dayOfWeek, { [field]: value })
      setHours((prev) => prev.map((h) => (h.day_of_week === dayOfWeek ? updated : h)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSavingDay(null)
    }
  }

  if (loading) return <div className="p-8 max-w-2xl mx-auto text-ink/60">Loading...</div>

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Operating hours</h1>

      {error && <p className="text-red-700 mb-4">{error}</p>}

      <div className="space-y-3">
        {hours.map((day) => (
          <div
            key={day.day_of_week}
            className="border border-line rounded-lg p-4 bg-white flex items-center gap-4 flex-wrap"
          >
            <div className="w-28 font-medium text-ink">{DAY_NAMES[day.day_of_week]}</div>

            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={day.is_closed}
                onChange={(e) => handleUpdate(day.day_of_week, 'is_closed', e.target.checked)}
              />
              Closed
            </label>

            {!day.is_closed && (
              <>
                <input
                  type="time"
                  value={day.open_time.slice(0, 5)}
                  onChange={(e) => handleUpdate(day.day_of_week, 'open_time', e.target.value + ':00')}
                  className="border border-line rounded-md px-2 py-1 focus:outline-none focus:border-court"
                />
                <span className="text-ink/40">to</span>
                <input
                  type="time"
                  value={day.close_time.slice(0, 5)}
                  onChange={(e) => handleUpdate(day.day_of_week, 'close_time', e.target.value + ':00')}
                  className="border border-line rounded-md px-2 py-1 focus:outline-none focus:border-court"
                />
              </>
            )}

            {savingDay === day.day_of_week && <span className="text-xs text-ink/40">Saving...</span>}
          </div>
        ))}
      </div>
    </div>
  )
}