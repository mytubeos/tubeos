// src/components/layout/DashboardLayout.jsx
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { NAV_ITEMS } from '../../utils/constants'

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
  return titles[pathname] || 'TubeOS'
}

export const DashboardLayout = () => {
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen bg-base-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar title={getPageTitle(pathname)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 max-w-screen-xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
