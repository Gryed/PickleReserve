import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="border-b border-line bg-paper">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="font-display font-semibold text-lg text-ink tracking-tight">
          Pickle<span className="text-court">Reserve</span>
        </Link>

        <div className="flex items-center gap-5 text-sm">
          {user ? (
            <>
              <Link to="/my-bookings" className="text-muted hover:text-court transition-colors">
                My bookings
              </Link>
              <button onClick={handleLogout} className="text-muted hover:text-court transition-colors">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-muted hover:text-court transition-colors">
                Log in
              </Link>
              <Link to="/signup" className="btn-court px-4 py-2 rounded-md font-medium transition-colors">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}