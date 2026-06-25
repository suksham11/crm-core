import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-bold text-indigo-600">
            CRM Core
          </Link>
          <Link to="/leads" className="text-sm text-gray-600 hover:text-indigo-600">
            Leads
          </Link>
          {user?.role === 'admin' && (
            <Link to="/users" className="text-sm text-gray-600 hover:text-indigo-600">
              Users
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {user?.full_name} <span className="text-xs text-gray-400">({user?.role})</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Logout
          </button>
        </div>
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
