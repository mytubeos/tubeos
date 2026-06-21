// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BarChart3, Flame, Calendar,
  Video, MessageCircle, Sparkles, TrendingUp,
  Youtube, Gift, Settings, LogOut, ChevronRight,
  Zap,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useChannelStore } from '../../store/channelStore'
import { useAuth } from '../../hooks/useAuth'
import { PlanBadge } from '../ui/Badge'
import { getInitials, formatNumber } from '../../utils/formatters'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/heatmap', label: 'Time Intel', icon: Flame },
    ],
  },
  {
    label: 'Content',
    items: [
      { path: '/scheduler', label: 'Scheduler', icon: Calendar },
      { path: '/videos', label: 'Videos', icon: Video },
      { path: '/comments', label: 'Comments', icon: MessageCircle },
    ],
  },
  {
    label: 'AI & Growth',
    items: [
      { path: '/ai', label: 'AI Tools', icon: Sparkles },
      { path: '/growth', label: 'Growth', icon: TrendingUp },
    ],
  },
  {
    label: 'Account',
    items: [
      { path: '/channels', label: 'Channels', icon: Youtube },
      { path: '/referral', label: 'Referral', icon: Gift },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export const Sidebar = ({ collapsed = false }) => {
  const { user } = useAuthStore()
  const { activeChannel } = useChannelStore()
  const { handleLogout } = useAuth()

  return (
    <aside className={`h-screen bg-base-800 border-r border-white/8 flex flex-col
                        transition-all duration-300
                        ${collapsed ? 'w-16' : 'w-60'}`}>

      {/* Logo */}
      <div className="p-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center shrink-0 shadow-brand">
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="font-display font-bold text-white text-base leading-none">TubeOS</p>
              <p className="text-gray-500 text-2xs mt-0.5">Command Center</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Channel */}
      {!collapsed && activeChannel && (
        <div className="mx-3 mt-3 p-3 glass rounded-xl">
          <div className="flex items-center gap-2.5">
            <img
              src={activeChannel.thumbnail || `https://ui-avatars.com/api/?name=${activeChannel.channelName}&background=4F46E5&color=fff`}
              alt={activeChannel.channelName}
              className="w-8 h-8 rounded-full object-cover ring-1 ring-brand/30"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{activeChannel.channelName}</p>
              <p className="text-2xs text-gray-500">
                {formatNumber(activeChannel.stats?.subscriberCount)} subs
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-3 px-2 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-2xs font-semibold text-gray-600 uppercase tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                     transition-all duration-150 cursor-pointer
                     ${isActive
                       ? 'bg-brand/15 text-brand border border-brand/20'
                       : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                     }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={17} className={isActive ? 'text-brand' : ''} />
                      {!collapsed && (
                        <>
                          <span className="flex-1">{label}</span>
                          {isActive && <ChevronRight size={14} className="text-brand/60" />}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Plan */}
      <div className="p-3 border-t border-white/8 space-y-2">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center
                            text-white text-xs font-bold shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <PlanBadge plan={user.plan} />
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm
                     text-gray-500 hover:text-rose hover:bg-rose/10 transition-all duration-150"
        >
          <LogOut size={16} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
