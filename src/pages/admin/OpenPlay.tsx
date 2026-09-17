import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Court } from '../../types/court'
import type {
  CreateOpenPlaySessionInput,
  OpenPlaySession,
  OpenPlaySessionStatus,
  UpdateOpenPlaySessionInput,
} from '../../types/openPlay'
import {
  cancelOpenPlaySession,
  createOpenPlaySession,
  getAdminOpenPlaySessions,
  publishOpenPlaySession,
  updateOpenPlaySession,
} from '../../services/openPlayService'
import { getCourts } from '../../services/courtService'
import { useAdminToast } from '../../context/AdminToastContext'

type StatusFilter = 'all' | OpenPlaySessionStatus

const statusFilters: {
  value: StatusFilter
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
]

const emptyForm = {
  session_reference: '',
  title: '',
  court_id: '',
  session_date: '',
  start_time: '',
  end_time: '',
  price_per_player: '',
  capacity: '',
  registration_opens_at: '',
  registration_closes_at: '',
  description: '',
  rules: '',
}

type SessionFormState = typeof emptyForm

export default function OpenPlay() {
  const navigate = useNavigate()
  const { success, error: showError } = useAdminToast()

  const [sessions, setSessions] = useState<
    OpenPlaySession[]
  >([])

  const [courts, setCourts] = useState<Court[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [filter, setFilter] =
    useState<StatusFilter>('all')

  const [showModal, setShowModal] =
    useState(false)

  const [editingSession, setEditingSession] =
    useState<OpenPlaySession | null>(null)

  const [form, setForm] =
    useState<SessionFormState>(emptyForm)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      const [sessionsData, courtsData] =
        await Promise.all([
          getAdminOpenPlaySessions(),
          getCourts(),
        ])

      setSessions(sessionsData)
      setCourts(courtsData)
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to load Open Play management data.'
      )
    } finally {
      setLoading(false)
    }
  }

  const filteredSessions = useMemo(() => {
    if (filter === 'all') {
      return sessions
    }

    return sessions.filter(
      (session) =>
        session.status === filter
    )
  }, [sessions, filter])

  function getCourtName(
    courtId: string
  ) {
    return (
      courts.find(
        (court) => court.id === courtId
      )?.name ?? 'Unknown Court'
    )
  }

  function getStatusLabel(
    status: OpenPlaySessionStatus
  ) {
    switch (status) {
      case 'draft':
        return 'Draft'

      case 'open':
        return 'Open'

      case 'closed':
        return 'Closed'

      case 'cancelled':
        return 'Cancelled'

      case 'completed':
        return 'Completed'

      default:
        return status
    }
  }

  function getStatusClasses(
    status: OpenPlaySessionStatus
  ) {
    switch (status) {
      case 'draft':
        return 'bg-line text-muted border-line'

      case 'open':
        return 'bg-court/15 text-court border-court/20'

      case 'closed':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'

      case 'cancelled':
        return 'bg-red-500/10 text-red-400 border-red-500/20'

      case 'completed':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20'

      default:
        return 'bg-line text-muted border-line'
    }
  }

  function formatDate(date: string) {
    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function formatTime(time: string) {
    const [hour, minute] =
      time.split(':').map(Number)

    const date = new Date()

    date.setHours(
      hour,
      minute,
      0,
      0
    )

    return date.toLocaleTimeString(
      'en-PH',
      {
        hour: 'numeric',
        minute: '2-digit',
      }
    )
  }

  function toDateTimeLocal(
    value: string
  ) {
    const date = new Date(value)

    const year =
      date.getFullYear()

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0')

    const day = String(
      date.getDate()
    ).padStart(2, '0')

    const hours = String(
      date.getHours()
    ).padStart(2, '0')

    const minutes = String(
      date.getMinutes()
    ).padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  function toIsoOrNull(
    value: string
  ) {
    if (!value) {
      return null
    }

    const date = new Date(value)

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null
    }

    return date.toISOString()
  }

  function updateField(
    field: keyof SessionFormState,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function openCreateModal() {
    setEditingSession(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEditModal(
    session: OpenPlaySession
  ) {
    if (
      session.status !== 'draft'
    ) {
      showError(
        'Only draft Open Play sessions can be edited.'
      )
      return
    }

    setEditingSession(session)

    setForm({
      session_reference:
        session.session_reference,

      title:
        session.title,

      court_id:
        session.court_id,

      session_date:
        session.session_date,

      start_time:
        session.start_time.slice(0, 5),

      end_time:
        session.end_time.slice(0, 5),

      price_per_player:
        String(
          session.price_per_player
        ),

      capacity:
        String(
          session.capacity
        ),

      registration_opens_at:
        session.registration_opens_at
          ? toDateTimeLocal(
              session.registration_opens_at
            )
          : '',

      registration_closes_at:
        session.registration_closes_at
          ? toDateTimeLocal(
              session.registration_closes_at
            )
          : '',

      description:
        session.description ?? '',

      rules:
        session.rules ?? '',
    })

    setShowModal(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setShowModal(false)
    setEditingSession(null)
    setForm(emptyForm)
  }

  function validateForm() {
    const reference =
      form.session_reference.trim()

    const title =
      form.title.trim()

    const price =
      Number(
        form.price_per_player
      )

    const capacity =
      Number(form.capacity)

    if (!reference) {
      showError(
        'Session reference is required.'
      )
      return false
    }

    if (!title) {
      showError(
        'Session title is required.'
      )
      return false
    }

    if (!form.court_id) {
      showError(
        'Please select a court.'
      )
      return false
    }

    if (!form.session_date) {
      showError(
        'Session date is required.'
      )
      return false
    }

    if (
      !form.start_time ||
      !form.end_time
    ) {
      showError(
        'Start and end time are required.'
      )
      return false
    }

    /*
      Open Play sessions must use
      exact hourly boundaries.

      Valid:
      06:00 → 08:00
      07:00 → 10:00

      Invalid:
      06:30 → 08:30
      07:15 → 09:15
    */
    if (
      !/^\d{2}:00$/.test(
        form.start_time
      ) ||
      !/^\d{2}:00$/.test(
        form.end_time
      )
    ) {
      showError(
        'Open Play sessions must start and end on an exact hour.'
      )
      return false
    }

    if (
      form.start_time >=
      form.end_time
    ) {
      showError(
        'End time must be later than start time.'
      )
      return false
    }

    if (
      Number.isNaN(price) ||
      price < 0
    ) {
      showError(
        'Please enter a valid price per player.'
      )
      return false
    }

    if (
      !Number.isInteger(capacity) ||
      capacity <= 0
    ) {
      showError(
        'Capacity must be a whole number greater than zero.'
      )
      return false
    }

    if (
      form.registration_opens_at &&
      form.registration_closes_at &&
      form.registration_opens_at >=
        form.registration_closes_at
    ) {
      showError(
        'Registration closing time must be later than opening time.'
      )
      return false
    }

    return true
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setSaving(true)

      if (editingSession) {
        const input: UpdateOpenPlaySessionInput =
          {
            id:
              editingSession.id,

            title:
              form.title.trim(),

            court_id:
              form.court_id,

            session_date:
              form.session_date,

            start_time:
              form.start_time,

            end_time:
              form.end_time,

            price_per_player:
              Number(
                form.price_per_player
              ),

            capacity:
              Number(
                form.capacity
              ),

            description:
              form.description.trim() ||
              null,

            rules:
              form.rules.trim() ||
              null,

            registration_opens_at:
              toIsoOrNull(
                form.registration_opens_at
              ),

            registration_closes_at:
              toIsoOrNull(
                form.registration_closes_at
              ),
          }

        await updateOpenPlaySession(
          input
        )

        success(
          'Open Play session updated successfully.'
        )
      } else {
        const input: CreateOpenPlaySessionInput =
          {
            session_reference:
              form.session_reference.trim(),

            title:
              form.title.trim(),

            court_id:
              form.court_id,

            session_date:
              form.session_date,

            start_time:
              form.start_time,

            end_time:
              form.end_time,

            price_per_player:
              Number(
                form.price_per_player
              ),

            capacity:
              Number(
                form.capacity
              ),

            description:
              form.description.trim() ||
              null,

            rules:
              form.rules.trim() ||
              null,

            registration_opens_at:
              toIsoOrNull(
                form.registration_opens_at
              ),

            registration_closes_at:
              toIsoOrNull(
                form.registration_closes_at
              ),
          }

        await createOpenPlaySession(
          input
        )

        success(
          'Open Play draft created successfully.'
        )
      }

      closeModal()

      await loadData()
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to save Open Play session.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(
    session: OpenPlaySession
  ) {
    const confirmed =
      confirm(
        `Publish "${session.title}"?\n\nThis will reserve the selected court time and make the Open Play session visible to customers.`
      )

    if (!confirmed) {
      return
    }

    try {
      setSaving(true)

      await publishOpenPlaySession(
        session.id
      )

      await loadData()

      success(
        'Open Play session published successfully.'
      )
    } catch (err) {
  console.error('OPEN PLAY LOAD ERROR:', err)

  if (err && typeof err === 'object') {
    console.error(
      'message:',
      'message' in err ? err.message : undefined
    )
    console.error(
      'code:',
      'code' in err ? err.code : undefined
    )
    console.error(
      'details:',
      'details' in err ? err.details : undefined
    )
    console.error(
      'hint:',
      'hint' in err ? err.hint : undefined
    )
  }

  showError(
    err instanceof Error
      ? err.message
      : 'Failed to load Open Play management data.'
  )
} finally {
      setSaving(false)
    }
  }

  async function handleCancel(
    session: OpenPlaySession
  ) {
    const reason =
      prompt(
        `Cancel "${session.title}"?\n\nOptional cancellation reason:`
      )

    if (reason === null) {
      return
    }

    try {
      setSaving(true)

      await cancelOpenPlaySession(
        session.id,
        reason.trim() || null
      )

      await loadData()

      success(
        'Open Play session cancelled.'
      )
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to cancel Open Play session.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="pr-page">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="pr-card p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-paper text-court">
              ...
            </div>

            <p className="text-sm text-muted">
              Loading Open Play sessions...
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pr-page">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* PAGE HEADER */}
        <section className="mb-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span>Admin</span>

                <span className="text-line">
                  /
                </span>

                <span className="text-court">
                  Open Play
                </span>
              </div>

              <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Open Play Sessions
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                Create, publish, manage, and cancel Open Play sessions.
              </p>
            </div>

            <button
              type="button"
              onClick={
                openCreateModal
              }
              className="btn-court inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold sm:w-auto"
            >
              <span className="text-base">
                +
              </span>

              Create Open Play
            </button>
          </div>
        </section>

        {/* FILTERS */}
        <section className="mb-6">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map(
              (item) => {
                const active =
                  filter ===
                  item.value

                return (
                  <button
                    key={
                      item.value
                    }
                    type="button"
                    onClick={() =>
                      setFilter(
                        item.value
                      )
                    }
                    className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                      active
                        ? 'border-court/30 bg-court/10 text-court'
                        : 'border-line bg-surface text-muted hover:border-court/20 hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              }
            )}
          </div>
        </section>

        {/* SESSION LIST */}
        {filteredSessions.length ===
        0 ? (
          <div className="pr-card border-dashed p-10 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-paper text-lg text-court">
              +
            </div>

            <p className="mt-4 font-medium text-ink">
              No Open Play sessions found.
            </p>

            <p className="mt-1 text-sm text-muted">
              {filter === 'all'
                ? 'Create your first session to get started.'
                : `There are no ${getStatusLabel(
                    filter
                  ).toLowerCase()} sessions.`}
            </p>

            {filter !== 'all' && (
              <button
                type="button"
                onClick={() =>
                  setFilter(
                    'all'
                  )
                }
                className="mt-4 text-xs font-semibold text-court hover:underline"
              >
                Show all sessions
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map(
              (session) => (
                <div
                  key={session.id}
                  className="pr-card p-4 transition duration-200 hover:border-court/20 sm:p-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                    {/* SESSION INFO */}
                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2.5">

                        <h2 className="font-display text-base font-semibold text-ink sm:text-lg">
                          {session.title}
                        </h2>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${getStatusClasses(
                            session.status
                          )}`}
                        >
                          {getStatusLabel(
                            session.status
                          )}
                        </span>
                      </div>

                      <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                        {
                          session.session_reference
                        }
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted sm:text-sm">

                        <span>
                          {getCourtName(
                            session.court_id
                          )}
                        </span>

                        <span>
                          {formatDate(
                            session.session_date
                          )}
                        </span>

                        <span>
                          {formatTime(
                            session.start_time
                          )}{' '}
                          –{' '}
                          {formatTime(
                            session.end_time
                          )}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">

                        <span className="font-semibold text-court">
                          ₱
                          {session.price_per_player.toFixed(
                            2
                          )}{' '}
                          / player
                        </span>

                        <span className="text-muted">
                          Capacity:{' '}
                          {
                            session.capacity
                          }
                        </span>
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/admin/open-play/${session.id}`
                          )
                        }
                        className="rounded-xl border border-line px-3.5 py-2.5 text-xs font-semibold text-ink transition hover:border-court/40 hover:text-court sm:text-sm"
                      >
                        Details
                      </button>

                      {session.status ===
                        'draft' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                session
                              )
                            }
                            className="rounded-xl border border-line px-3.5 py-2.5 text-xs font-semibold text-ink transition hover:border-court/40 hover:text-court sm:text-sm"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handlePublish(
                                session
                              )
                            }
                            disabled={
                              saving
                            }
                            className="btn-court rounded-xl px-3.5 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                          >
                            Publish
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleCancel(
                                session
                              )
                            }
                            disabled={
                              saving
                            }
                            className="rounded-xl border border-red-500/20 px-3.5 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {session.status ===
                        'open' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCancel(
                              session
                            )
                          }
                          disabled={
                            saving
                          }
                          className="rounded-xl border border-red-500/20 px-3.5 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* FOOTER */}
        <footer className="py-6 text-center">
          <p className="text-[10px] text-muted">
            PickleReserve Admin • Open Play
          </p>
        </footer>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              closeModal()
            }
          }}
        >
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl">

            {/* MODAL HEADER */}
            <div className="sticky top-0 z-10 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur-md sm:px-6">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-court">
                    Open Play
                  </p>

                  <h2 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">
                    {editingSession
                      ? 'Edit Draft Session'
                      : 'Create Session'}
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">
                    Configure the session before publishing it to customers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                  className="rounded-xl border border-line px-2.5 py-1.5 text-xl leading-none text-muted transition hover:border-court/30 hover:text-ink disabled:opacity-50"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* FORM */}
            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-4 p-5 sm:p-6"
            >

              {/* REFERENCE + TITLE */}
              <div className="grid gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Session Reference
                  </label>

                  <input
                    type="text"
                    value={
                      form.session_reference
                    }
                    onChange={(e) =>
                      updateField(
                        'session_reference',
                        e.target.value
                      )
                    }
                    disabled={
                      Boolean(
                        editingSession
                      )
                    }
                    placeholder="OP-2026-0001"
                    className="pr-input px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    required
                  />

                  {editingSession && (
                    <p className="mt-1.5 text-[10px] text-muted">
                      Session reference cannot be changed after creation.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Session Title
                  </label>

                  <input
                    type="text"
                    value={
                      form.title
                    }
                    onChange={(e) =>
                      updateField(
                        'title',
                        e.target.value
                      )
                    }
                    placeholder="Saturday Open Play"
                    className="pr-input px-3 py-2.5 text-sm"
                    required
                  />
                </div>
              </div>

              {/* COURT */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  Court
                </label>

                <select
                  value={
                    form.court_id
                  }
                  onChange={(e) =>
                    updateField(
                      'court_id',
                      e.target.value
                    )
                  }
                  className="pr-input px-3 py-2.5 text-sm"
                  required
                >
                  <option value="">
                    Select a court
                  </option>

                  {courts
                    .filter(
                      (court) =>
                        court.status ===
                        'available'
                    )
                    .map(
                      (court) => (
                        <option
                          key={
                            court.id
                          }
                          value={
                            court.id
                          }
                        >
                          {
                            court.name
                          }
                          {court.type
                            ? ` — ${court.type}`
                            : ''}
                        </option>
                      )
                    )}
                </select>

                <p className="mt-1.5 text-[10px] leading-5 text-muted">
                  Only courts currently marked Available can be used for Open Play.
                </p>
              </div>

              {/* DATE / TIME */}
              <div className="grid gap-4 sm:grid-cols-3">

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Session Date
                  </label>

                  <input
                    type="date"
                    value={
                      form.session_date
                    }
                    onChange={(e) =>
                      updateField(
                        'session_date',
                        e.target.value
                      )
                    }
                    min={
                      new Date()
                        .toISOString()
                        .slice(
                          0,
                          10
                        )
                    }
                    className="pr-input px-3 py-2.5 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Start Time
                  </label>

                  <input
                    type="time"
                    value={
                      form.start_time
                    }
                    onChange={(e) =>
                      updateField(
                        'start_time',
                        e.target.value
                      )
                    }
                    step="3600"
                    className="pr-input px-3 py-2.5 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    End Time
                  </label>

                  <input
                    type="time"
                    value={
                      form.end_time
                    }
                    onChange={(e) =>
                      updateField(
                        'end_time',
                        e.target.value
                      )
                    }
                    step="3600"
                    className="pr-input px-3 py-2.5 text-sm"
                    required
                  />
                </div>
              </div>

              {/* EXACT HOUR NOTICE */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3.5 py-3">
                <p className="text-[11px] leading-5 text-blue-300">
                  Open Play uses exact hourly blocks only.
                  Example: 6:00 PM–8:00 PM is valid;
                  6:30 PM–8:30 PM is not allowed.
                </p>
              </div>

              {/* PRICE + CAPACITY */}
              <div className="grid gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Price / Player
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.price_per_player
                    }
                    onChange={(e) =>
                      updateField(
                        'price_per_player',
                        e.target.value
                      )
                    }
                    placeholder="250"
                    className="pr-input px-3 py-2.5 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">
                    Capacity
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      form.capacity
                    }
                    onChange={(e) =>
                      updateField(
                        'capacity',
                        e.target.value
                      )
                    }
                    placeholder="8"
                    className="pr-input px-3 py-2.5 text-sm"
                    required
                  />
                </div>
              </div>

              {/* REGISTRATION WINDOW */}
              <div className="rounded-xl border border-line bg-paper p-4">

                <div className="mb-3">
                  <p className="text-sm font-medium text-ink">
                    Registration Window
                  </p>

                  <p className="mt-1 text-[10px] leading-5 text-muted sm:text-xs">
                    Optional. Leave blank if registration should follow the session's Open status.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink">
                      Opens
                    </label>

                    <input
                      type="datetime-local"
                      value={
                        form.registration_opens_at
                      }
                      onChange={(e) =>
                        updateField(
                          'registration_opens_at',
                          e.target.value
                        )
                      }
                      className="pr-input px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink">
                      Closes
                    </label>

                    <input
                      type="datetime-local"
                      value={
                        form.registration_closes_at
                      }
                      onChange={(e) =>
                        updateField(
                          'registration_closes_at',
                          e.target.value
                        )
                      }
                      className="pr-input px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  Description
                </label>

                <textarea
                  value={
                    form.description
                  }
                  onChange={(e) =>
                    updateField(
                      'description',
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Open Play session details..."
                  className="pr-input resize-none px-3 py-2.5 text-sm"
                />
              </div>

              {/* RULES */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  Rules
                </label>

                <textarea
                  value={
                    form.rules
                  }
                  onChange={(e) =>
                    updateField(
                      'rules',
                      e.target.value
                    )
                  }
                  rows={4}
                  placeholder="Session rules, reminders, and player guidelines..."
                  className="pr-input resize-none px-3 py-2.5 text-sm"
                />
              </div>

              {/* BUTTONS */}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                  className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="btn-court flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? 'Saving...'
                    : editingSession
                      ? 'Save Changes'
                      : 'Create Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}