// src/pages/admin/AdminLayout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Zap, Tag, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag },
]

export const AdminLayout = () => {
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-base-900 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-white/8 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/8">
          <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center shadow-brand">
            <Zap size={15} className="text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-sm leading-none">TubeOS</p>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck size={10} className="text-rose" />
              <p className="text-2xs text-rose font-medium">Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/8">
          <button
            onClick={handleLogout}
            className="nav-item w-full text-rose/70 hover:text-rose hover:bg-rose/5"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
