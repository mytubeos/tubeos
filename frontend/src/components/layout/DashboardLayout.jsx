// src/components/layout/DashboardLayout.jsx
import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { PlanActivatedModal } from '../features/PlanActivatedModal'
import { ContentReportButton } from '../features/ContentReportButton'
import { Link } from 'react-router-dom'
import notificationAPI from '../../api/notification.api'

// Map path to page title
const getPageTitle = (pathname) => {
  const titles = {
    '/dashboard': 'Dashboard',
    '/analytics': 'Analytics',
    '/heatmap': 'Best Time',
    '/scheduler': 'Scheduler',
    '/videos': 'Videos',
    '/videos/upload': 'Upload Video',
    '/comments': 'Comment Inbox',
    '/ai': 'AI Tools',
    '/ai/shorts': 'Script Studio',
    '/growth': 'Growth',
    '/channels': 'Channels',
    '/referral': 'Referral',
    '/settings': 'Settings',
  }
  return titles[pathname] || 'Vezrin'
}

export const DashboardLayout = () => {
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [celebration, setCelebration] = useState(null)

  // Close the mobile drawer automatically whenever the route changes
  useEffect(() => {
    setMobileNavOpen(false)
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' })
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
    if (celebration)
      notificationAPI
        .markRead(celebration._id)
        .then(() => window.dispatchEvent(new Event('notifications-changed')))
        .catch(() => {})
    setCelebration(null)
  }

  return (
    <div className="flex h-[100dvh] bg-base-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main Content */}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <Navbar title={getPageTitle(pathname)} onMenuClick={() => setMobileNavOpen(true)} />

        {/* Page Content */}
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
          <div key={pathname} className="p-3 sm:p-5 max-w-screen-xl mx-auto route-enter">
            {['/ai', '/comments', '/videos/upload', '/growth'].some((path) =>
              pathname.startsWith(path)
            ) && (
              <aside className="mb-4 rounded-xl border border-white/10 p-3 flex flex-wrap justify-between items-center gap-2">
                <p className="text-xs text-gray-400">
                  AI tools send your submitted text, images or selected channel/comment data to AI
                  providers. Review outputs before publishing.{' '}
                  <Link to="/privacy#ai-data" className="text-brand underline">
                    Data details
                  </Link>
                </p>
                <ContentReportButton />
              </aside>
            )}
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
