import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signUp(email, password, username.trim())

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-lg p-8 w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-ink mb-6">Sign up</h1>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="mb-4">
          <label className="block text-sm font-medium text-muted mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-muted mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-muted mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
            required
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-court py-2 rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>

        <p className="text-sm text-center text-muted mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-court font-medium hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}