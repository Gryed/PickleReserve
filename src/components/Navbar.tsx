
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const { user, username, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/')
    
  }

  return (
    <nav className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-8">
        <Link
          to="/"
          className="font-display text-lg font-semibold tracking-tight text-ink"
        >
          Pickle<span className="text-court">Reserve</span>
        </Link>

        <div className="flex items-center gap-5 text-sm">
          {user ? (
            <>
              <span className="hidden text-ink sm:inline">
                Hi! {username ?? 'there'}
              </span>

              <NotificationBell userId={user.id} />

              <Link
                to="/my-bookings"
                className="text-muted transition-colors hover:text-court"
              >
                My bookings
              </Link>

              <Link
                to="/find-booking"
                className="text-muted transition-colors hover:text-court"
              >
                Find booking
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="text-muted transition-colors hover:text-court"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              to="/find-booking"
              className="text-muted transition-colors hover:text-court"
            >
              Find booking
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
