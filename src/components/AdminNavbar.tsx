import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/courts', label: 'Courts' },
  { to: '/admin/hours', label: 'Hours' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/payments/pending', label: 'Pending' },
  { to: '/admin/reservations', label: 'Reservations' },
  { to: '/admin/reports', label: 'Reports' },
]

export default function AdminNavbar() {
  const { signOut, username } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="border-b border-line bg-paper">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-1 text-sm shrink-0">
          {LINKS.map((link) => {
            const isActive = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                className={
                  'px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ' +
                  (isActive ? 'bg-court/15 text-court font-medium' : 'text-muted hover:text-ink')
                }
              >
                {link.label}
              </Link>
            )
          })}
        </div>
                <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted hidden sm:inline">Hi! {username ?? 'there'}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-muted hover:text-red-400 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}