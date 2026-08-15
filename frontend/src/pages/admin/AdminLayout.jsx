// src/pages/admin/AdminLayout.jsx
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Zap,
  Tag,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
  Menu,
  X,
  IndianRupee,
  Gauge,
  ArrowLeft,
  Mail,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useState, useEffect } from 'react'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag },
  { to: '/admin/pricing', label: 'Pricing', icon: IndianRupee },
  { to: '/admin/limits', label: 'Plan Limits', icon: Gauge },
  { to: '/admin/report-settings', label: 'Report Emails', icon: Mail },
]

const SidebarContent = ({ onClose, onLogout, onExit }) => (
  <>
    {/* Logo */}
    <div className="h-16 flex items-center justify-between px-5 border-b border-white/8">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center shadow-brand">
          <Zap size={15} className="text-white" />
        </div>
        <div>
          <p className="font-display font-bold text-white text-sm leading-none">Vezrin</p>
          <div className="flex items-center gap-1 mt-0.5">
            <ShieldCheck size={10} className="text-rose" />
            <p className="text-2xs text-rose font-medium">Admin</p>
          </div>
        </div>
      </div>
      {/* Close button — mobile only */}
      {onClose && (
        <button
          onClick={onClose}
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/8"
        >
          <X size={18} />
        </button>
      )}
    </div>

    {/* Back to the regular app — there was no way out of /admin before this */}
    <div className="p-3 border-b border-white/8">
      <button
        onClick={onExit}
        className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm
                 text-gray-400 hover:text-brand hover:bg-brand/10 transition-all duration-150"
      >
        <ArrowLeft size={16} />
        Back to App
      </button>
    </div>

    {/* Nav */}
    <nav className="flex-1 p-3 space-y-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onClose}
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
        onClick={onLogout}
        className="nav-item w-full text-rose/70 hover:text-rose hover:bg-rose/5"
      >
        <LogOut size={16} />
        Logout
      </button>
    </div>
  </>
)

export const AdminLayout = () => {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleExit = () => navigate('/dashboard')

  return (
    <div className="min-h-screen bg-base-900 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-white/8 flex-col">
        <SidebarContent onLogout={handleLogout} onExit={handleExit} />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-base-900 border-r border-white/8
                    transition-transform duration-300 md:hidden
                    ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent
          onClose={() => setDrawerOpen(false)}
          onLogout={handleLogout}
          onExit={handleExit}
        />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden h-14 flex items-center gap-3 px-4 border-b border-white/8 bg-base-900">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/8"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand-gradient rounded-md flex items-center justify-center">
              <Zap size={12} className="text-white" />
            </div>
            <span className="font-display font-bold text-white text-sm">Admin</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
