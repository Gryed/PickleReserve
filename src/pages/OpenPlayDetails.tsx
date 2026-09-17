import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getOpenPlaySession,
  joinOpenPlaySession,
} from '../services/openPlayService'
import type {
  OpenPlayParticipant,
  OpenPlaySessionPublic,
} from '../types/openPlay'

export default function OpenPlayDetails() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user, username } = useAuth()

  const [session, setSession] =
    useState<OpenPlaySessionPublic | null>(null)

  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [showJoinForm, setShowJoinForm] =
    useState(false)

  const [participantName, setParticipantName] =
    useState('')

  const [contactPhone, setContactPhone] =
    useState('')

  const [participant, setParticipant] =
    useState<OpenPlayParticipant | null>(null)

  useEffect(() => {
    loadSession()
  }, [sessionId])

  useEffect(() => {
    if (username && !participantName) {
      setParticipantName(username)
    }
  }, [username, participantName])

  async function loadSession() {
    if (!sessionId) {
      setError('Open Play session was not found.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const data =
        await getOpenPlaySession(sessionId)

      setSession(data)
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load Open Play session.'
      )
    } finally {
      setLoading(false)
    }
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(
      new Date(`${date}T00:00:00`)
    )
  }

  function formatTime(time: string) {
    const [hours, minutes] =
      time.split(':').map(Number)

    const date = new Date()

    date.setHours(
      hours,
      minutes,
      0,
      0
    )

    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  function formatDateTime(
    value: string | null
  ) {
    if (!value) {
      return null
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return null
    }

    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  function handleJoinClick() {
    if (!user) {
      navigate(
        `/login?redirect=/open-play/${sessionId}`
      )
      return
    }

    setParticipantName(
      username ?? ''
    )

    setShowJoinForm(true)
  }

  async function handleJoin(
    e: React.FormEvent
  ) {
    e.preventDefault()

    if (!sessionId) {
      return
    }

    const name =
      participantName.trim()

    if (!name) {
      setError(
        'Participant name is required.'
      )
      return
    }

    try {
      setJoining(true)
      setError(null)

      const result =
        await joinOpenPlaySession({
          session_id: sessionId,
          participant_name: name,
          contact_phone:
            contactPhone.trim() || null,
        })

      setParticipant(result)
      setShowJoinForm(false)
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to join Open Play session.'
      )
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <main className="pr-page">
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
          <div className="pr-card p-10 text-center">
            <p className="text-sm text-muted">
              Loading Open Play session...
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (error && !session) {
    return (
      <main className="pr-page">
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
          <div className="pr-card p-8 text-center">
            <p className="text-sm font-medium text-red-400">
              {error}
            </p>

            <Link
              to="/open-play"
              className="mt-5 inline-flex rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-court/30 hover:text-court"
            >
              ← Back to Open Play
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!session) {
    return null
  }

  const registrationOpens =
    formatDateTime(
      session.registration_opens_at
    )

  const registrationCloses =
    formatDateTime(
      session.registration_closes_at
    )

  return (
    <main className="pr-page">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">

        {/* BACK */}
        <Link
          to="/open-play"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted transition hover:text-court"
        >
          ← Back to Open Play
        </Link>

        {/* HEADER */}
        <section className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-court">
                {session.session_reference}
              </p>

              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {session.title}
              </h1>

              <p className="mt-2 text-sm text-muted">
                {session.court_name}
              </p>
            </div>

            <span className="inline-flex w-fit rounded-full border border-court/20 bg-court/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-court">
              {session.status}
            </span>
          </div>
        </section>

        {/* MAIN CARD */}
        <section className="mt-7 grid gap-5 lg:grid-cols-[1fr_300px]">

          {/* DETAILS */}
          <div className="pr-card p-6 sm:p-7">

            <div className="grid gap-5 sm:grid-cols-2">

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                  Date
                </p>

                <p className="mt-1.5 text-sm font-medium text-ink">
                  {formatDate(
                    session.session_date
                  )}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                  Time
                </p>

                <p className="mt-1.5 text-sm font-medium text-ink">
                  {formatTime(
                    session.start_time
                  )}{' '}
                  –{' '}
                  {formatTime(
                    session.end_time
                  )}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                  Price
                </p>

                <p className="mt-1.5 font-display text-xl font-bold text-court">
                  ₱
                  {session.price_per_player.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-muted">
                    / player
                  </span>
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                  Capacity
                </p>

                <p className="mt-1.5 text-sm font-medium text-ink">
                  {session.capacity} players
                </p>
              </div>
            </div>

            {session.description && (
              <div className="mt-7 border-t border-line pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  About this session
                </p>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink">
                  {session.description}
                </p>
              </div>
            )}

            {session.rules && (
              <div className="mt-6 border-t border-line pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Rules & Guidelines
                </p>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink">
                  {session.rules}
                </p>
              </div>
            )}

            {(registrationOpens ||
              registrationCloses) && (
              <div className="mt-6 border-t border-line pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Registration Window
                </p>

                <div className="mt-2 space-y-1 text-sm text-ink">
                  {registrationOpens && (
                    <p>
                      Opens:{' '}
                      {registrationOpens}
                    </p>
                  )}

                  {registrationCloses && (
                    <p>
                      Closes:{' '}
                      {registrationCloses}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* JOIN PANEL */}
          <aside className="h-fit pr-card p-6">

            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              Open Play
            </p>

            <p className="mt-2 font-display text-2xl font-bold text-ink">
              ₱
              {session.price_per_player.toLocaleString()}
            </p>

            <p className="mt-1 text-xs text-muted">
              per player
            </p>

            {participant ? (
              <div className="mt-6 rounded-xl border border-court/20 bg-court/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-court">
                  You're on the list
                </p>

                <p className="mt-2 text-sm font-medium text-ink">
                  {participant.participant_name}
                </p>

                <p className="mt-1 text-xs text-muted">
                  Status:{' '}
                  <span className="font-semibold text-court">
                    {participant.status}
                  </span>
                </p>

                {participant.hold_expires_at && (
                  <p className="mt-2 text-xs text-muted">
                    Hold expires:{' '}
                    {formatDateTime(
                      participant.hold_expires_at
                    )}
                  </p>
                )}

                <p className="mt-4 text-xs leading-5 text-muted">
                  Your spot is temporarily held.
                  Complete the payment step before
                  the hold expires.
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={
                    handleJoinClick
                  }
                  className="btn-court mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold"
                >
                  Join Open Play
                </button>

                <p className="mt-3 text-center text-[10px] leading-5 text-muted">
                  Login is required to join a session.
                </p>
              </>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-xs leading-5 text-red-400">
                  {error}
                </p>
              </div>
            )}
          </aside>
        </section>
      </div>

      {/* JOIN MODAL */}
      {showJoinForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              if (!joining) {
                setShowJoinForm(false)
              }
            }
          }}
        >
          <div className="w-full max-w-lg rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl">

            <div className="border-b border-line px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-court">
                    Join Open Play
                  </p>

                  <h2 className="mt-1 font-display text-xl font-bold text-ink">
                    {session.title}
                  </h2>

                  <p className="mt-1 text-xs text-muted">
                    Your spot will be held for 15 minutes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowJoinForm(false)
                  }
                  disabled={joining}
                  className="rounded-xl border border-line px-2.5 py-1.5 text-xl leading-none text-muted transition hover:border-court/30 hover:text-ink disabled:opacity-50"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <form
              onSubmit={handleJoin}
              className="space-y-4 p-5 sm:p-6"
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  Participant Name
                </label>

                <input
                  type="text"
                  value={participantName}
                  onChange={(e) =>
                    setParticipantName(
                      e.target.value
                    )
                  }
                  className="pr-input px-3 py-2.5 text-sm"
                  placeholder="Your name"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  Contact Phone
                </label>

                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) =>
                    setContactPhone(
                      e.target.value
                    )
                  }
                  className="pr-input px-3 py-2.5 text-sm"
                  placeholder="09XXXXXXXXX"
                />
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-xs leading-5 text-blue-300">
                  Joining will temporarily hold your
                  Open Play slot for 15 minutes. You
                  will need to complete the payment
                  submission before the hold expires.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    setShowJoinForm(false)
                  }
                  disabled={joining}
                  className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={joining}
                  className="btn-court flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {joining
                    ? 'Joining...'
                    : 'Confirm Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}