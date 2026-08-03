import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { OfflineBadge } from './OfflineBadge';

export function Layout() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-teal-600 text-white p-2 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg tracking-wide">HealthSync</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavLink 
            to="/dashboard"
            className={({ isActive }) => 
              `block px-4 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-teal-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink 
            to="/patients"
            className={({ isActive }) => 
              `block px-4 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-teal-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`
            }
          >
            Patients
          </NavLink>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={logout}
            className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar with offline badge */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-end px-6 shadow-sm z-0">
          <div className="w-32">
            <OfflineBadge />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
