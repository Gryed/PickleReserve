
import { useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: '⌂' },
  { to: '/admin/courts', label: 'Courts', icon: '🏓' },
  { to: '/admin/hours', label: 'Hours', icon: '◷' },
  { to: '/admin/payments', label: 'Payments', icon: '₱' },
  { to: '/admin/payments/pending', label: 'Pending', icon: '✓' },
  {
    to: '/admin/reservations',
    label: 'Reservations',
    icon: '▣',
  },
  {
    to: '/admin/create-booking',
    label: 'Create Booking',
    icon: '+',
  },
  { to: '/admin/reports', label: 'Reports', icon: '▥' },
]

export default function AdminNavbar() {
  const { user, signOut, username } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* =====================================================
            TOP BAR
        ===================================================== */}
        <div className="flex h-16 items-center justify-between gap-4">

          {/* ===================================================
              BRAND
          =================================================== */}
          <Link
            to="/admin"
            onClick={closeMenu}
            className="group flex shrink-0 items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-court text-sm font-bold text-paper shadow-[0_0_20px_rgba(207,255,51,0.08)] transition group-hover:scale-105">
              🏓
            </div>

            <div className="hidden sm:block">
              <p className="font-display text-sm font-bold tracking-tight text-ink">
                PickleReserve
              </p>

              <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted">
                Admin
              </p>
            </div>
          </Link>

          {/* ===================================================
              DESKTOP NAV
          =================================================== */}
          <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
            <div className="flex items-center gap-1">
              {LINKS.map((link) => {
                const isActive =
                  location.pathname === link.to

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={
                      'whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ' +
                      (isActive
                        ? 'bg-court/10 text-court'
                        : 'text-muted hover:bg-surface hover:text-ink')
                    }
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* ===================================================
              DESKTOP USER + NOTIFICATIONS
          =================================================== */}
          <div className="hidden shrink-0 items-center gap-3 lg:flex">

            {/* NOTIFICATION BELL */}
            {user && (
              <NotificationBell userId={user.id} />
            )}

            {/* USER INFO */}
            <div className="text-right">
              <p className="text-xs font-medium text-ink">
                {username ?? 'Admin'}
              </p>

              <p className="text-[10px] text-muted">
                Administrator
              </p>
            </div>

            {/* LOGOUT */}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition hover:border-red-400/40 hover:text-red-400"
            >
              Log out
            </button>
          </div>

          {/* ===================================================
              MOBILE MENU BUTTON
          =================================================== */}
          <button
            type="button"
            onClick={() =>
              setMenuOpen((open) => !open)
            }
            aria-label={
              menuOpen
                ? 'Close menu'
                : 'Open menu'
            }
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:border-court/40 hover:text-court lg:hidden"
          >
            {menuOpen ? (
              <span className="text-xl leading-none">
                ×
              </span>
            ) : (
              <span className="text-lg leading-none">
                ☰
              </span>
            )}
          </button>
        </div>

        {/* =====================================================
            MOBILE MENU
        ===================================================== */}
        {menuOpen && (
          <div className="border-t border-line py-3 lg:hidden">

            {/* =================================================
                MOBILE USER
            ================================================= */}
            <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">

              <div>
                <p className="text-xs font-semibold text-ink">
                  {username ?? 'Admin'}
                </p>

                <p className="mt-0.5 text-[10px] text-muted">
                  Administrator
                </p>
              </div>

              <div className="flex items-center gap-2">

                {/* MOBILE NOTIFICATION */}
                {user && (
                  <NotificationBell
                    userId={user.id}
                  />
                )}

                {/* ROLE BADGE */}
                <span className="rounded-full bg-court/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-court">
                  Admin
                </span>
              </div>
            </div>

            {/* =================================================
                NAV LINKS
            ================================================= */}
            <div className="grid grid-cols-2 gap-2">
              {LINKS.map((link) => {
                const isActive =
                  location.pathname === link.to

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeMenu}
                    className={
                      'flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition ' +
                      (isActive
                        ? 'border-court/30 bg-court/10 text-court'
                        : 'border-line bg-surface text-muted hover:border-court/20 hover:text-ink')
                    }
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-paper text-xs">
                      {link.icon}
                    </span>

                    <span className="truncate">
                      {link.label}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* =================================================
                LOGOUT
            ================================================= */}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center rounded-xl border border-line px-4 py-3 text-xs font-medium text-muted transition hover:border-red-400/40 hover:text-red-400"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
