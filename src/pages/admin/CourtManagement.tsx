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

type CourtStatus = Court['status']

export default function CourtManagement() {
  const [courts, setCourts] = useState<Court[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
  const [editStatus, setEditStatus] =
    useState<CourtStatus>('available')
  const [savingEdit, setSavingEdit] = useState(false)

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

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  async function handleAddCourt(e: React.FormEvent) {
    e.preventDefault()

    clearMessages()
    setSubmitting(true)

    try {
      const parsedPrice = parseFloat(price)

      if (!name.trim()) {
        setError('Court name is required.')
        return
      }

      if (
        Number.isNaN(parsedPrice) ||
        parsedPrice <= 0
      ) {
        setError(
          'Please enter a valid price per hour.'
        )
        return
      }

      await createCourt({
        name: name.trim(),
        type: type.trim() || null,
        price_per_hour: parsedPrice,
        status: 'available',

        // Weekend pricing is OFF by default.
        weekend_pricing_enabled: false,
        weekend_price_per_hour: null,
      })

      setName('')
      setType('')
      setPrice('')

      await loadData()

      setSuccess('Court added successfully.')
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

  function openEditModal(court: Court) {
    clearMessages()

    setEditingCourt(court)

    setEditName(court.name)
    setEditType(court.type ?? '')
    setEditPrice(
      String(court.price_per_hour)
    )

    setEditWeekendEnabled(
      court.weekend_pricing_enabled
    )

    setEditWeekendPrice(
      court.weekend_price_per_hour !== null
        ? String(court.weekend_price_per_hour)
        : ''
    )

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
    setEditStatus('available')
  }

  async function handleSaveEdit(
    e: React.FormEvent
  ) {
    e.preventDefault()

    if (!editingCourt) return

    clearMessages()
    setSavingEdit(true)

    try {
      const parsedPrice =
        parseFloat(editPrice)

      const parsedWeekendPrice =
        editWeekendPrice.trim() === ''
          ? null
          : parseFloat(editWeekendPrice)

      if (!editName.trim()) {
        setError('Court name is required.')
        return
      }

      if (
        Number.isNaN(parsedPrice) ||
        parsedPrice <= 0
      ) {
        setError(
          'Please enter a valid price per hour.'
        )
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
        setError(
          'Please enter a valid weekend price per hour.'
        )
        return
      }

      await updateCourt(
        editingCourt.id,
        {
          name: editName.trim(),
          type: editType.trim() || null,
          price_per_hour: parsedPrice,

          weekend_pricing_enabled:
            editWeekendEnabled,

          weekend_price_per_hour:
            editWeekendEnabled
              ? parsedWeekendPrice
              : null,

          status: editStatus,
        }
      )

      closeEditModal()

      await loadData()

      setSuccess(
        'Court updated successfully.'
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update court'
      )
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(
    id: string,
    courtName: string
  ) {
    clearMessages()

    const confirmed = confirm(
      `Delete "${courtName}"?\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    try {
      await deleteCourt(id)

      await loadData()

      setSuccess(
        `${courtName} deleted successfully.`
      )
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

    clearMessages()

    try {
      const updated =
        await updateSettings({
          show_court_type:
            !settings.show_court_type,
        })

      setSettings(updated)

      setSuccess(
        updated.show_court_type
          ? 'Court type is now visible to customers.'
          : 'Court type is now hidden from customers.'
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update settings'
      )
    }
  }

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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-muted sm:p-8">
        Loading court management...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6 sm:p-8">
      {/* HEADER */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-court">
          ADMIN
        </p>

        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
          Court Management
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted">
          Add, edit, and manage the courts available
          in your facility.
        </p>
      </div>

      {/* MESSAGES */}
      {error && (
        <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-lg border border-court/20 bg-court/10 px-4 py-3 text-sm text-court">
          {success}
        </div>
      )}

      {/* CUSTOMER DISPLAY SETTINGS */}
      {settings && (
        <div className="mb-8 flex items-center justify-between gap-5 rounded-xl border border-line bg-surface p-5">
          <div>
            <p className="font-medium text-ink">
              Show court type/surface to customers
            </p>

            <p className="mt-1 text-sm leading-5 text-muted">
              Toggle off to hide the court type field
              from the public booking page.
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleShowType}
            aria-label="Toggle court type visibility"
            className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
              settings.show_court_type
                ? 'bg-court'
                : 'bg-line'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-paper transition-transform ${
                settings.show_court_type
                  ? 'translate-x-6'
                  : ''
              }`}
            />
          </button>
        </div>
      )}

      {/* ADD COURT */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="font-display text-xl font-semibold text-ink">
            Add a court
          </h2>

          <p className="mt-1 text-sm text-muted">
            New courts are added as Available by
            default. Weekend pricing is disabled
            by default.
          </p>
        </div>

        <form
          onSubmit={handleAddCourt}
          className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input
            type="text"
            placeholder="Court name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            className="rounded-md border border-line bg-paper px-3 py-2.5 text-ink placeholder:text-muted focus:border-court focus:outline-none"
            required
          />

          <input
            type="text"
            placeholder="Type / Surface"
            value={type}
            onChange={(e) =>
              setType(e.target.value)
            }
            className="rounded-md border border-line bg-paper px-3 py-2.5 text-ink placeholder:text-muted focus:border-court focus:outline-none"
          />

          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Price / hour"
            value={price}
            onChange={(e) =>
              setPrice(e.target.value)
            }
            className="rounded-md border border-line bg-paper px-3 py-2.5 text-ink placeholder:text-muted focus:border-court focus:outline-none"
            required
          />

          <button
            type="submit"
            disabled={submitting}
            className="btn-court rounded-md px-4 py-2.5 font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? 'Adding...'
              : 'Add Court'}
          </button>
        </form>
      </section>

      {/* COURT LIST */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              Your courts
            </h2>

            <p className="mt-1 text-sm text-muted">
              {courts.length}{' '}
              {courts.length === 1
                ? 'court'
                : 'courts'}{' '}
              configured
            </p>
          </div>
        </div>

        {courts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
            <p className="font-medium text-ink">
              No courts yet.
            </p>

            <p className="mt-1 text-sm text-muted">
              Add your first court using the form
              above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {courts.map((court) => (
              <div
                key={court.id}
                className="rounded-xl border border-line bg-surface p-5"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  {/* COURT INFO */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-display text-lg font-semibold text-ink">
                        {court.name}
                      </h3>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                          court.status
                        )}`}
                      >
                        {getStatusLabel(
                          court.status
                        )}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
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

                    {!court.weekend_pricing_enabled && (
                      <p className="mt-2 text-xs text-muted">
                        Weekend pricing: Off
                      </p>
                    )}
                  </div>

                  {/* ACTIONS */}
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(court)
                      }
                      className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-court hover:text-court"
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
                      className="rounded-md border border-red-500/20 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeEditModal()
            }
          }}
        >
          <div className="w-full max-w-lg rounded-t-2xl border border-line bg-surface p-6 shadow-2xl sm:rounded-2xl">
            {/* MODAL HEADER */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-court">
                  COURT
                </p>

                <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
                  Edit Court
                </h2>

                <p className="mt-1 text-sm text-muted">
                  Update the court information,
                  pricing, and status.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={savingEdit}
                className="rounded-md px-2 py-1 text-xl text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* EDIT FORM */}
            <form
              onSubmit={handleSaveEdit}
              className="space-y-4"
            >
              {/* NAME */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  Court Name
                </label>

                <input
                  type="text"
                  value={editName}
                  onChange={(e) =>
                    setEditName(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Court 1"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-ink placeholder:text-muted focus:border-court focus:outline-none"
                  required
                />
              </div>

              {/* TYPE */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  Type / Surface
                </label>

                <input
                  type="text"
                  value={editType}
                  onChange={(e) =>
                    setEditType(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Indoor, Outdoor"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-ink placeholder:text-muted focus:border-court focus:outline-none"
                />
              </div>

              {/* REGULAR PRICE */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  Weekday price per hour
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) =>
                    setEditPrice(
                      e.target.value
                    )
                  }
                  placeholder="250"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-ink placeholder:text-muted focus:border-court focus:outline-none"
                  required
                />

                <p className="mt-1.5 text-xs text-muted">
                  Regular rate used Monday through
                  Friday.
                </p>
              </div>

              {/* WEEKEND PRICING */}
              <div className="rounded-xl border border-line bg-paper p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Weekend pricing
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted">
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
                    className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
                      editWeekendEnabled
                        ? 'bg-court'
                        : 'bg-line'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-paper transition-transform ${
                        editWeekendEnabled
                          ? 'translate-x-6'
                          : ''
                      }`}
                    />
                  </button>
                </div>

                {editWeekendEnabled && (
                  <div className="mt-4">
                    <label className="mb-1.5 block text-sm font-medium text-ink">
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
                      className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-court focus:outline-none"
                      required
                    />

                    <p className="mt-2 text-xs text-muted">
                      This rate will be used for
                      Saturday and Sunday bookings.
                    </p>
                  </div>
                )}
              </div>

              {/* STATUS */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  Status
                </label>

                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(
                      e.target.value as CourtStatus
                    )
                  }
                  className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-ink focus:border-court focus:outline-none"
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
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={savingEdit}
                  className="flex-1 rounded-md border border-line px-4 py-2.5 font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-court flex-1 rounded-md px-4 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
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
  )
}