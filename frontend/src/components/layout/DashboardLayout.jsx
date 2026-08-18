// src/components/layout/DashboardLayout.jsx
import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { PlanActivatedModal } from '../features/PlanActivatedModal'
import notificationAPI from '../../api/notification.api'

// Map path to page title
const getPageTitle = (pathname) => {
  const titles = {
    '/dashboard': 'Dashboard',
    '/analytics': 'Analytics',
    '/heatmap': 'Time Intelligence',
    '/scheduler': 'Scheduler',
    '/videos': 'Videos',
    '/videos/upload': 'Upload Video',
    '/comments': 'Comment Inbox',
    '/ai': 'AI Tools',
    '/growth': 'Growth Intelligence',
    '/channels': 'Channels',
    '/referral': 'Referral',
    '/settings': 'Settings',
  }
  return titles[pathname] || 'Vezrin'
}

export const DashboardLayout = () => {
  const { pathname } = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [celebration, setCelebration] = useState(null)

  // Close the mobile drawer automatically whenever the route changes
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  // Once per app open: surface an admin plan grant as a full-screen
  // celebration instead of leaving it to sit quietly in the notif bell.
  useEffect(() => {
    notificationAPI
      .getAll({ unreadOnly: true, limit: 20 })
      .then((res) => {
        const notifications = res.data.data?.notifications || []
        const found = notifications.find((n) => n.type === 'plan_activated')
        if (found) setCelebration(found)
      })
      .catch(() => {
        // Silent — same as the navbar's background poll, no toast spam
      })
  }, [])

  const dismissCelebration = () => {
    if (celebration) notificationAPI.markRead(celebration._id).catch(() => {})
    setCelebration(null)
  }

  return (
    <div className="flex h-screen bg-base-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar title={getPageTitle(pathname)} onMenuClick={() => setMobileNavOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 max-w-screen-xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {celebration && (
        <PlanActivatedModal message={celebration.message} onClose={dismissCelebration} />
      )}
    </div>
  )
}
