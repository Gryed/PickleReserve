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
          PickleReserve
        </Link>

        <div className="flex items-center gap-5 text-sm">
          {user ? (
            <>
              <Link to="/my-bookings" className="text-ink/70 hover:text-court transition-colors">
                My bookings
              </Link>
              <button onClick={handleLogout} className="text-ink/70 hover:text-court transition-colors">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-ink/70 hover:text-court transition-colors">
                Log in
              </Link>
              <Link
                to="/signup"
                className="bg-court text-paper px-4 py-2 rounded-md font-medium hover:bg-court-dark transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}