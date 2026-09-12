
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
import { useAdminToast } from '../../context/AdminToastContext'

type CourtStatus = Court['status']

export default function CourtManagement() {
  const { success, error: showError } = useAdminToast()

  const [courts, setCourts] = useState<Court[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)

  const [loading, setLoading] = useState(true)

  // Add court
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edit court
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editWeekendEnabled, setEditWeekendEnabled] = useState(false)
  const [editWeekendPrice, setEditWeekendPrice] = useState('')
  const [edit24Hours, setEdit24Hours] = useState(false)
  const [editStatus, setEditStatus] =
    useState<CourtStatus>('available')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      const [courtsData, settingsData] = await Promise.all([
        getCourts(),
        getSettings(),
      ])

      setCourts(courtsData)
      setSettings(settingsData)
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to load court management data.'
      )
    } finally {
      setLoading(false)
    }
  }

  /* =========================================================
     ADD COURT
  ========================================================= */

  async function handleAddCourt(e: React.FormEvent) {
    e.preventDefault()

    /*
      Validate BEFORE changing submitting state
      or calling any database operation.
    */
    const trimmedName = name.trim()
    const trimmedType = type.trim()
    const parsedPrice = parseFloat(price)

    if (!trimmedName) {
      showError('Court name is required.')
      return
    }

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      showError('Please enter a valid price per hour.')
      return
    }

    try {
      setSubmitting(true)

      await createCourt({
        name: trimmedName,
        type: trimmedType || null,
        price_per_hour: parsedPrice,
        status: 'available',

        // Weekend pricing is OFF by default.
        weekend_pricing_enabled: false,
        weekend_price_per_hour: null,

        // 24-hour operations is OFF by default.
        is_24_hours: false,
      })

      setName('')
      setType('')
      setPrice('')

      await loadData()

      success('Court added successfully')
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to add court.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  /* =========================================================
     EDIT COURT
  ========================================================= */

  function openEditModal(court: Court) {
    setEditingCourt(court)

    setEditName(court.name)
    setEditType(court.type ?? '')
    setEditPrice(String(court.price_per_hour))

    setEditWeekendEnabled(
      court.weekend_pricing_enabled
    )

    setEditWeekendPrice(
      court.weekend_price_per_hour !== null
        ? String(court.weekend_price_per_hour)
        : ''
    )

    setEdit24Hours(court.is_24_hours)

    setEditStatus(court.status)
  }

  function closeEditModal() {
    if (savingEdit) return

    setEditingCourt(null)

    setEditName('')
    setEditType('')
    setEditPrice('')
    setEditWeekendEnabled(false)
    setEditWeekendPrice('')
    setEdit24Hours(false)
    setEditStatus('available')
  }

  async function handleSaveEdit(
    e: React.FormEvent
  ) {
    e.preventDefault()

    if (!editingCourt) return

    /*
      Validate BEFORE entering saving state
      or sending anything to Supabase.
    */
    const trimmedName = editName.trim()
    const trimmedType = editType.trim()

    const parsedPrice = parseFloat(editPrice)

    const parsedWeekendPrice =
      editWeekendPrice.trim() === ''
        ? null
        : parseFloat(editWeekendPrice)

    if (!trimmedName) {
      showError('Court name is required.')
      return
    }

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      showError('Please enter a valid price per hour.')
      return
    }

    if (
      editWeekendEnabled &&
      (
        parsedWeekendPrice === null ||
        Number.isNaN(parsedWeekendPrice) ||
        parsedWeekendPrice <= 0
      )
    ) {
      showError(
        'Please enter a valid weekend price per hour.'
      )
      return
    }

    try {
      setSavingEdit(true)

      await updateCourt(
        editingCourt.id,
        {
          name: trimmedName,
          type: trimmedType || null,
          price_per_hour: parsedPrice,

          weekend_pricing_enabled:
            editWeekendEnabled,

          weekend_price_per_hour:
            editWeekendEnabled
              ? parsedWeekendPrice
              : null,

          is_24_hours: edit24Hours,

          status: editStatus,
        }
      )

      closeEditModal()

      await loadData()

      success('Court updated successfully')
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to update court.'
      )
    } finally {
      setSavingEdit(false)
    }
  }

  /* =========================================================
     DELETE COURT
  ========================================================= */

  async function handleDelete(
    id: string,
    courtName: string
  ) {
    const confirmed = confirm(
      `Delete "${courtName}"?\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    try {
      await deleteCourt(id)

      await loadData()

      success(`${courtName} deleted successfully`)
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to delete court.'
      )
    }
  }

  /* =========================================================
     SETTINGS
  ========================================================= */

  async function handleToggleShowType() {
    if (!settings) return

    try {
      const updated =
        await updateSettings({
          show_court_type:
            !settings.show_court_type,
        })

      setSettings(updated)

      success(
        updated.show_court_type
          ? 'Court type is now visible to customers'
          : 'Court type is now hidden from customers'
      )
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to update settings.'
      )
    }
  }

  /* =========================================================
     STATUS HELPERS
  ========================================================= */

  function getStatusLabel(
    status: CourtStatus
  ) {
    switch (status) {
      case 'available':
        return 'Available'

      case 'maintenance':
        return 'Maintenance'

      case 'not_available':
        return 'Not Available'

      default:
        return status
    }
  }

  function getStatusClasses(
    status: CourtStatus
  ) {
    switch (status) {
      case 'available':
        return 'bg-court/15 text-court border-court/20'

      case 'maintenance':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'

      case 'not_available':
        return 'bg-red-500/10 text-red-400 border-red-500/20'

      default:
        return 'bg-line text-muted border-line'
    }
  }

  /* =========================================================
     INITIAL LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="pr-page">
        <div className="mx-auto max-w-5xl px-4 py-8 text-muted sm:px-6 sm:py-10">
          <div className="pr-card p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-paper text-court">
              🏓
            </div>

            <p className="text-sm text-muted">
              Loading court management...
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pr-page">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">

        {/* HEADER */}
        <div className="mb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-court">
            Admin / Courts
          </p>

          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Court Management
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            Add, edit, and manage the courts available
            in your facility.
          </p>
        </div>

        {/* CUSTOMER DISPLAY SETTINGS */}
        {settings && (
          <section className="pr-card mb-7 p-5">
            <div className="flex items-center justify-between gap-5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Show court type/surface to customers
                </p>

                <p className="mt-1 text-xs leading-5 text-muted">
                  Toggle off to hide the court type field
                  from the public booking page.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleShowType}
                aria-label="Toggle court type visibility"
                aria-pressed={settings.show_court_type}
                className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
                  settings.show_court_type
                    ? 'bg-court'
                    : 'bg-line'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-paper shadow-sm transition-transform ${
                    settings.show_court_type
                      ? 'translate-x-6'
                      : ''
                  }`}
                />
              </button>
            </div>
          </section>
        )}

        {/* ADD COURT */}
        <section className="mb-9">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">
              Add a court
            </h2>

            <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">
              New courts are added as Available by default.
              Weekend pricing and 24-hour operations are
              disabled by default.
            </p>
          </div>

          <form
            onSubmit={handleAddCourt}
            className="pr-card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4"
          >
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Court name
              </label>

              <input
                type="text"
                placeholder="Court 1"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                className="pr-input px-3 py-2.5 text-sm"
                required
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Type / Surface
              </label>

              <input
                type="text"
                placeholder="Indoor / Outdoor"
                value={type}
                onChange={(e) =>
                  setType(e.target.value)
                }
                className="pr-input px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Price / hour
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="250"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value)
                }
                className="pr-input px-3 py-2.5 text-sm"
                required
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="btn-court w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? 'Adding...'
                  : 'Add Court'}
              </button>
            </div>
          </form>
        </section>

        {/* COURT LIST */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">
                Your courts
              </h2>

              <p className="mt-1 text-xs text-muted sm:text-sm">
                {courts.length}{' '}
                {courts.length === 1
                  ? 'court'
                  : 'courts'}{' '}
                configured
              </p>
            </div>
          </div>

          {courts.length === 0 ? (
            <div className="pr-card border-dashed p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-paper text-xl text-court">
                🏓
              </div>

              <p className="mt-4 font-medium text-ink">
                No courts yet.
              </p>

              <p className="mt-1 text-sm text-muted">
                Add your first court using the form above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {courts.map((court) => (
                <div
                  key={court.id}
                  className="pr-card p-4 transition duration-200 hover:border-court/20 sm:p-5"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                    {/* COURT INFO */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-display text-base font-semibold text-ink sm:text-lg">
                          {court.name}
                        </h3>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${getStatusClasses(
                            court.status
                          )}`}
                        >
                          {getStatusLabel(
                            court.status
                          )}
                        </span>

                        {court.is_24_hours && (
                          <span className="rounded-full border border-court/20 bg-court/10 px-2.5 py-1 text-[10px] font-semibold text-court sm:text-xs">
                            24 Hours
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted sm:text-sm">
                        {court.type && (
                          <span>
                            {court.type}
                          </span>
                        )}

                        <span>
                          ₱
                          {court.price_per_hour.toFixed(
                            2
                          )}{' '}
                          / hour
                        </span>

                        {court.weekend_pricing_enabled && (
                          <span className="font-medium text-court">
                            Weekend: ₱
                            {(
                              court.weekend_price_per_hour ??
                              court.price_per_hour
                            ).toFixed(2)}{' '}
                            / hour
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted sm:text-xs">
                        <span>
                          24-hour operations:{' '}
                          {court.is_24_hours
                            ? 'On'
                            : 'Off'}
                        </span>

                        {!court.weekend_pricing_enabled && (
                          <span>
                            Weekend pricing: Off
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEditModal(court)
                        }
                        className="rounded-xl border border-line px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-court/40 hover:text-court sm:text-sm"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            court.id,
                            court.name
                          )
                        }
                        className="rounded-xl border border-red-500/20 px-3.5 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 sm:text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* EDIT MODAL */}
        {editingCourt && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                closeEditModal()
              }
            }}
          >
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl">

              {/* MODAL HEADER */}
              <div className="sticky top-0 z-10 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur-md sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-court">
                      Court
                    </p>

                    <h2 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">
                      Edit Court
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">
                      Update court information, pricing,
                      operating mode, and status.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={savingEdit}
                    className="rounded-xl border border-line px-2.5 py-1.5 text-xl leading-none text-muted transition hover:border-court/30 hover:text-ink disabled:opacity-50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* EDIT FORM */}
              <form
                onSubmit={handleSaveEdit}
                className="space-y-4 p-5 sm:p-6"
              >
                {/* NAME */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Court Name
                  </label>

                  <input
                    type="text"
                    value={editName}
                    onChange={(e) =>
                      setEditName(e.target.value)
                    }
                    placeholder="e.g. Court 1"
                    className="pr-input px-3 py-2.5 text-sm"
                    required
                  />
                </div>

                {/* TYPE */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Type / Surface
                  </label>

                  <input
                    type="text"
                    value={editType}
                    onChange={(e) =>
                      setEditType(e.target.value)
                    }
                    placeholder="e.g. Indoor, Outdoor"
                    className="pr-input px-3 py-2.5 text-sm"
                  />
                </div>

                {/* REGULAR PRICE */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Weekday price per hour
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) =>
                      setEditPrice(e.target.value)
                    }
                    placeholder="250"
                    className="pr-input px-3 py-2.5 text-sm"
                    required
                  />

                  <p className="mt-1.5 text-[10px] leading-5 text-muted sm:text-xs">
                    Regular rate used when weekend
                    pricing is not active.
                  </p>
                </div>

                {/* WEEKEND PRICING */}
                <div className="rounded-xl border border-line bg-paper p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        Weekend pricing
                      </p>

                      <p className="mt-1 text-[10px] leading-5 text-muted sm:text-xs">
                        Use a different hourly rate on
                        Saturday and Sunday.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setEditWeekendEnabled(
                          !editWeekendEnabled
                        )
                      }
                      aria-label="Toggle weekend pricing"
                      aria-pressed={editWeekendEnabled}
                      className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
                        editWeekendEnabled
                          ? 'bg-court'
                          : 'bg-line'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-paper shadow-sm transition-transform ${
                          editWeekendEnabled
                            ? 'translate-x-6'
                            : ''
                        }`}
                      />
                    </button>
                  </div>

                  {editWeekendEnabled && (
                    <div className="mt-4">
                      <label className="mb-1.5 block text-xs font-medium text-ink">
                        Weekend price per hour
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editWeekendPrice}
                        onChange={(e) =>
                          setEditWeekendPrice(
                            e.target.value
                          )
                        }
                        placeholder="300"
                        className="pr-input px-3 py-2.5 text-sm"
                        required
                      />

                      <p className="mt-2 text-[10px] leading-5 text-muted sm:text-xs">
                        This rate will be used for
                        Saturday and Sunday bookings.
                      </p>
                    </div>
                  )}
                </div>

                {/* 24 HOURS OPERATIONS */}
                <div className="rounded-xl border border-line bg-paper p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        24 Hours Operations
                      </p>

                      <p className="mt-1 text-[10px] leading-5 text-muted sm:text-xs">
                        Allow this court to accept bookings
                        throughout the full 24-hour day.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setEdit24Hours(!edit24Hours)
                      }
                      aria-label="Toggle 24 hours operations"
                      aria-pressed={edit24Hours}
                      className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
                        edit24Hours
                          ? 'bg-court'
                          : 'bg-line'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-paper shadow-sm transition-transform ${
                          edit24Hours
                            ? 'translate-x-6'
                            : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                    <p className="text-[10px] leading-5 text-muted sm:text-xs">
                      {edit24Hours
                        ? 'ON — This court will use 24-hour availability.'
                        : 'OFF — This court will follow the normal Operating Hours schedule.'}
                    </p>
                  </div>
                </div>

                {/* STATUS */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Status
                  </label>

                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(
                        e.target.value as CourtStatus
                      )
                    }
                    className="pr-input px-3 py-2.5 text-sm"
                  >
                    <option value="available">
                      Available
                    </option>

                    <option value="maintenance">
                      Maintenance
                    </option>

                    <option value="not_available">
                      Not Available
                    </option>
                  </select>
                </div>

                {/* BUTTONS */}
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={savingEdit}
                    className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="btn-court flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingEdit
                      ? 'Saving...'
                      : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
