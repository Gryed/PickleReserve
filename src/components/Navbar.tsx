
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
          className="flex shrink-0 items-center gap-2"
        >
          <img
            src="/images/alexxamie-hero.jpg"
            alt="Alex Xamie Pickleball Zone"
            className="h-9 w-9 rounded-xl object-cover"
          />

          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-tight text-ink sm:text-base">
              Alex Xamie
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted sm:text-[10px]">
              Pickleball Zone
            </p>
          </div>
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
