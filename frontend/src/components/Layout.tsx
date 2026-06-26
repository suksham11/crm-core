import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="text-lg font-extrabold tracking-tight text-indigo-600 sm:text-xl"
            >
              CRM Core
            </Link>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 sm:hidden">
              {user?.role}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Link
              to="/"
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
            >
              Dashboard
            </Link>
            <Link
              to="/leads"
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
            >
              Leads
            </Link>
            {user?.role === "admin" && (
              <Link
                to="/users"
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
              >
                Users
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-700">
                {user?.full_name}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
