
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Footer() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [loginOpen, setLoginOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function openLogin() {
    setError('')
    setUsername('')
    setPassword('')
    setLoginOpen(true)
  }

  function closeLogin() {
    if (loading) return

    setLoginOpen(false)
    setError('')
    setUsername('')
    setPassword('')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    setError('')

    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }

    setLoading(true)

    const { error: signInError } = await signIn(
      username.trim(),
      password
    )

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setLoading(false)
      setLoginOpen(false)
      setUsername('')
      setPassword('')
      setError('')

      if (profile?.role === 'admin') {
        navigate('/admin')
        return
      }

      navigate('/')
      return
    }

    setLoading(false)
    setLoginOpen(false)
    setUsername('')
    setPassword('')
    navigate('/')
  }

  return (
    <>
      {/* FOOTER */}
      <footer className="mt-12 w-full border-t border-line bg-surface">
        <div className="w-full px-5 py-5 sm:px-8 sm:py-6">

          {/* MAIN FOOTER */}
          <div className="grid gap-5 sm:grid-cols-3 sm:items-start">

            {/* BRAND */}
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-ink">
                <span className="text-court">ALEX XAMEI PICKLEBALL ZONE</span>
              </p>

              <p className="mt-2 max-w-sm text-xs leading-5 text-muted">
                Simple court reservations made easy.
              </p>
            </div>

            {/* QUICK LINKS */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-court">
                Quick Links
              </p>

              <div className="flex flex-col items-start gap-2 text-xs">
                <Link
                  to="/booking"
                  className="text-muted transition-colors hover:text-court"
                >
                  Book a Court
                </Link>

                <Link
                  to="/find-booking"
                  className="text-muted transition-colors hover:text-court"
                >
                  Find Booking
                </Link>

                <button
                  type="button"
                  onClick={openLogin}
                  className="font-medium text-muted transition-colors hover:text-court"
                >
                  Staff Login
                </button>
              </div>
            </div>

            {/* SUPPORT */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-court">
                Support
              </p>

              <div className="flex flex-col items-start gap-2 text-xs">
                <a
                  href="https://www.facebook.com/jelarjoychristian"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted transition-colors hover:text-court"
                >
                  Contact Us
                </a>

                <a
                  href="https://pickleblisscourt.com/#"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted transition-colors hover:text-court"
                >
                  FAQs
                </a>

                <a
                  href="https://pickleblisscourt.com/#"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted transition-colors hover:text-court"
                >
                  Terms of Use
                </a>
              </div>
            </div>
          </div>

          {/* DIVIDER */}
          <div className="my-5 border-t border-line" />

          {/* COPYRIGHT */}
          <div className="flex flex-col gap-2 text-[10px] text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} ALEX XAMEI PICKLEBALL ZONE. All rights reserved.
            </p>

            <p>
              Developed by{' '}
              <span className="font-medium text-court">
                Gryed
              </span>
            </p>
          </div>
        </div>
      </footer>

      {/* STAFF LOGIN MODAL */}
      {loginOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-login-title"
        >
          {/* BACKDROP */}
          <button
            type="button"
            aria-label="Close staff login"
            onClick={closeLogin}
            className="absolute inset-0 cursor-default"
          />

          {/* LOGIN MODAL */}
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">

            {/* HEADER */}
            <div className="flex items-start justify-between border-b border-line p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-court">
                  Staff Access
                </p>

                <h2
                  id="staff-login-title"
                  className="mt-1 font-display text-xl font-semibold text-ink"
                >
                  Staff Login
                </h2>

                <p className="mt-1 text-xs text-muted">
                  Sign in to access the ALEX XAMEI PICKLEBALL ZONE admin panel.
                </p>
              </div>

              <button
                type="button"
                onClick={closeLogin}
                disabled={loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-lg text-muted transition-colors hover:border-court hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleLogin}
              className="space-y-4 p-5"
            >
              {error && (
                <div className="rounded-xl border border-red-900/30 bg-red-950/20 px-4 py-3">
                  <p className="text-sm font-medium text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* USERNAME */}
              <div>
                <label
                  htmlFor="staff-username"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Username
                </label>

                <input
                  id="staff-username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)

                    if (error) {
                      setError('')
                    }
                  }}
                  placeholder="Enter username"
                  autoComplete="username"
                  disabled={loading}
                  className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted transition-colors focus:border-court disabled:opacity-50"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="staff-password"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Password
                </label>

                <input
                  id="staff-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)

                    if (error) {
                      setError('')
                    }
                  }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted transition-colors focus:border-court disabled:opacity-50"
                />
              </div>

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="btn-court w-full rounded-xl px-5 py-3.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>

              <p className="text-center text-[11px] text-muted">
                Staff access only
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
