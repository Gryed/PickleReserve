
import { useEffect, useState } from 'react'
import type { OperatingHours } from '../../types/availability'
import {
  getOperatingHours,
  updateOperatingHours,
} from '../../services/availabilityService'
import { useAdminToast } from '../../context/AdminToastContext'

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export default function OperatingHoursPage() {
  const { success, error: showError } = useAdminToast()

  const [hours, setHours] = useState<OperatingHours[]>([])
  const [loading, setLoading] = useState(true)
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
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to load operating hours'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(
    dayOfWeek: number,
    field: 'open_time' | 'close_time' | 'is_closed',
    value: string | boolean
  ) {
    const currentDay = hours.find(
      (day) => day.day_of_week === dayOfWeek
    )

    if (!currentDay) return

    /*
     * Validate time before saving.
     * We only need to validate when changing
     * either opening or closing time.
     */
    if (
      field === 'open_time' ||
      field === 'close_time'
    ) {
      const nextOpenTime =
        field === 'open_time'
          ? String(value)
          : currentDay.open_time

      const nextCloseTime =
        field === 'close_time'
          ? String(value)
          : currentDay.close_time

      const openMinutes = timeToMinutes(nextOpenTime)
      const closeMinutes = timeToMinutes(nextCloseTime)

      if (
        openMinutes === null ||
        closeMinutes === null
      ) {
        showError(
          `${DAY_NAMES[dayOfWeek]} has an invalid time.`
        )
        return
      }

      if (closeMinutes <= openMinutes) {
        showError(
          `${DAY_NAMES[dayOfWeek]} closing time must be later than opening time.`
        )
        return
      }
    }

    try {
      setSavingDay(dayOfWeek)

      const updated = await updateOperatingHours(
        dayOfWeek,
        {
          [field]: value,
        }
      )

      setHours((prev) =>
        prev.map((day) =>
          day.day_of_week === dayOfWeek
            ? updated
            : day
        )
      )

      success(
        `${DAY_NAMES[dayOfWeek]} updated successfully`
      )
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to update operating hours'
      )
    } finally {
      setSavingDay(null)
    }
  }

  function timeToMinutes(
    time: string
  ): number | null {
    if (!time) return null

    const parts = time.slice(0, 5).split(':')

    if (parts.length !== 2) return null

    const hoursValue = Number(parts[0])
    const minutesValue = Number(parts[1])

    if (
      Number.isNaN(hoursValue) ||
      Number.isNaN(minutesValue)
    ) {
      return null
    }

    if (
      hoursValue < 0 ||
      hoursValue > 23 ||
      minutesValue < 0 ||
      minutesValue > 59
    ) {
      return null
    }

    return hoursValue * 60 + minutesValue
  }

  function formatTime(time: string) {
    if (!time) return ''

    return time.slice(0, 5)
  }

  if (loading) {
    return (
      <main className="pr-page">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="pr-card w-full max-w-md p-8 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-paper text-court">
              <span className="animate-spin text-lg">
                ↻
              </span>
            </div>

            <p className="mt-4 text-sm font-semibold text-ink">
              Loading operating hours...
            </p>

            <p className="mt-1 text-xs text-muted">
              Please wait while we load your schedule.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pr-page">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">

        {/* HEADER */}

        <section className="mb-7">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            <span>Admin</span>

            <span className="text-line">
              /
            </span>

            <span className="text-court">
              Hours
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Operating Hours
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            Set the regular opening and closing schedule
            for your pickleball courts.
          </p>
        </section>

        {/* INFO */}

        <section className="mb-5 rounded-xl border border-blue-400/20 bg-blue-400/5 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-400/10 text-xs text-blue-400">
              ℹ
            </div>

            <div>
              <p className="text-xs font-semibold text-ink">
                Schedule information
              </p>

              <p className="mt-1 text-[10px] leading-5 text-muted sm:text-xs">
                Changes are saved automatically when
                you update a day's schedule. Courts
                configured for 24-hour operations can
                follow their own availability rules.
              </p>
            </div>
          </div>
        </section>

        {/* HOURS */}

        <section className="pr-card overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">
                  Weekly Schedule
                </h2>

                <p className="mt-1 text-xs text-muted">
                  Regular operating hours
                </p>
              </div>

              <div className="hidden items-center gap-2 text-[10px] text-muted sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-court" />
                Auto-saved
              </div>
            </div>
          </div>

          <div className="divide-y divide-line">
            {hours.map((day) => {
              const isSaving =
                savingDay === day.day_of_week

              return (
                <div
                  key={day.day_of_week}
                  className="p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    {/* DAY */}

                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-xs font-bold text-court">
                        {DAY_NAMES[
                          day.day_of_week
                        ].slice(0, 2)}
                      </div>

                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold text-ink">
                          {
                            DAY_NAMES[
                              day.day_of_week
                            ]
                          }
                        </p>

                        <p className="mt-0.5 text-[10px] text-muted">
                          {day.is_closed
                            ? 'Closed'
                            : `${formatTime(
                                day.open_time
                              )} – ${formatTime(
                                day.close_time
                              )}`}
                        </p>
                      </div>
                    </div>

                    {/* CONTROLS */}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                      {/* CLOSED TOGGLE */}

                      <label
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                          day.is_closed
                            ? 'border-red-400/20 bg-red-400/5'
                            : 'border-line bg-paper'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={day.is_closed}
                          disabled={isSaving}
                          onChange={(e) =>
                            handleUpdate(
                              day.day_of_week,
                              'is_closed',
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 accent-[var(--color-court)]"
                        />

                        <span
                          className={`text-xs font-medium ${
                            day.is_closed
                              ? 'text-red-400'
                              : 'text-muted'
                          }`}
                        >
                          Closed
                        </span>
                      </label>

                      {/* TIME CONTROLS */}

                      {!day.is_closed && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

                          <input
                            type="time"
                            value={formatTime(
                              day.open_time
                            )}
                            disabled={isSaving}
                            onChange={(e) =>
                              handleUpdate(
                                day.day_of_week,
                                'open_time',
                                `${e.target.value}:00`
                              )
                            }
                            className="pr-input min-w-0 px-3 py-2.5 text-sm sm:w-32"
                            aria-label={`${DAY_NAMES[day.day_of_week]} opening time`}
                          />

                          <span className="hidden text-xs text-muted sm:inline">
                            to
                          </span>

                          <input
                            type="time"
                            value={formatTime(
                              day.close_time
                            )}
                            disabled={isSaving}
                            onChange={(e) =>
                              handleUpdate(
                                day.day_of_week,
                                'close_time',
                                `${e.target.value}:00`
                              )
                            }
                            className="pr-input min-w-0 px-3 py-2.5 text-sm sm:w-32"
                            aria-label={`${DAY_NAMES[day.day_of_week]} closing time`}
                          />
                        </div>
                      )}

                      {/* STATUS */}

                      <div className="flex min-h-9 items-center justify-start sm:min-w-[90px] sm:justify-end">
                        {isSaving ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted">
                            <span className="animate-spin">
                              ↻
                            </span>

                            Saving...
                          </span>
                        ) : (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${
                              day.is_closed
                                ? 'border-red-400/20 bg-red-400/5 text-red-400'
                                : 'border-court/20 bg-court/10 text-court'
                            }`}
                          >
                            {day.is_closed
                              ? 'Closed'
                              : 'Open'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* EMPTY STATE */}

        {hours.length === 0 && (
          <div className="pr-card mt-5 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-paper text-court">
              ◷
            </div>

            <p className="mt-4 text-sm font-semibold text-ink">
              No operating hours found
            </p>

            <p className="mt-1 text-xs text-muted">
              No weekly schedule is currently
              configured.
            </p>

            <button
              type="button"
              onClick={loadHours}
              className="mt-4 rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink transition hover:border-court/30 hover:text-court"
            >
              Retry
            </button>
          </div>
        )}

        {/* FOOTER */}

        <footer className="py-6 text-center">
          <p className="text-[10px] text-muted">
            PickleReserve Admin
          </p>
        </footer>
      </div>
    </main>
  )
}
