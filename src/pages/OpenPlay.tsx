import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getOpenPlaySessions,
} from '../services/openPlayService'
import type { OpenPlaySessionPublic } from '../types/openPlay'

export default function OpenPlay() {
  const [sessions, setSessions] = useState<OpenPlaySessionPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true)
        setError(null)

        const data = await getOpenPlaySessions()
        setSessions(data)
      } catch (err) {
        console.error(err)

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load Open Play sessions.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadSessions()
  }, [])

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(`${date}T00:00:00`))
  }

  function formatTime(time: string) {
    const [hours, minutes] = time.split(':').map(Number)

    const date = new Date()
    date.setHours(hours, minutes, 0, 0)

    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <main className="bg-paper text-ink">
      {/* HEADER */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-12">
          <p className="text-xs font-semibold tracking-[0.2em] text-court">
            OPEN PLAY
          </p>

          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Find your next game.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            Join an upcoming Open Play session, meet other players,
            and enjoy the game without booking an entire court.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-12">
          {loading && (
            <div className="flex min-h-40 items-center justify-center">
              <p className="text-sm text-muted">
                Loading Open Play sessions...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <p className="text-sm font-medium text-red-700">
                {error}
              </p>
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface p-10 text-center">
              <p className="font-display text-xl font-semibold text-ink">
                No Open Play sessions yet.
              </p>

              <p className="mt-2 text-sm text-muted">
                Check back soon for upcoming games.
              </p>
            </div>
          )}

          {!loading && !error && sessions.length > 0 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <article
                  key={session.id}
                  className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-1 hover:border-court"
                >
                  <div className="border-b border-line p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-court">
                          {session.session_reference}
                        </p>

                        <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                          {session.title}
                        </h2>
                      </div>

                      <span className="rounded-full bg-court/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-court">
                        Open
                      </span>
                    </div>

                    <p className="mt-4 text-sm font-medium text-ink">
                      {session.court_name}
                    </p>
                  </div>

                  <div className="space-y-4 p-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Date
                      </p>

                      <p className="mt-1 text-sm text-ink">
                        {formatDate(session.session_date)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Time
                      </p>

                      <p className="mt-1 text-sm text-ink">
                        {formatTime(session.start_time)} —{' '}
                        {formatTime(session.end_time)}
                      </p>
                    </div>

                    <div className="flex items-end justify-between gap-4 border-t border-line pt-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Price
                        </p>

                        <p className="mt-1 font-display text-xl font-semibold text-ink">
                          ₱{session.price_per_player.toLocaleString()}
                          <span className="ml-1 text-xs font-normal text-muted">
                            / player
                          </span>
                        </p>
                      </div>

                      <Link
                        to={`/open-play/${session.id}`}
                        className="btn-court inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"
                      >
                        View Session
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}