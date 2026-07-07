// src/pages/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Tag, CheckCircle, MousePointerClick, Crown, TrendingUp, UserX } from 'lucide-react'
import { MetricCard } from '../../components/ui/Card'
import adminAPI from '../../api/admin.api'

export const AdminDashboard = () => {
  const [userStats, setUserStats] = useState(null)
  const [couponStats, setCouponStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminAPI.getUserStats(), adminAPI.getCouponStats()])
      .then(([u, c]) => {
        setUserStats(u.data.data)
        setCouponStats(c.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const userMetrics = [
    { label: 'Total Users', value: userStats?.total ?? '—', icon: Users, iconColor: 'brand' },
    { label: 'Paid Users', value: userStats?.paid ?? '—', icon: Crown, iconColor: 'amber' },
    { label: 'Free Users', value: userStats?.free ?? '—', icon: TrendingUp, iconColor: 'cyan' },
    { label: 'Banned', value: userStats?.banned ?? '—', icon: UserX, iconColor: 'rose' },
  ]

  const planMetrics = [
    { label: 'Creator', value: userStats?.creator ?? '—', icon: CheckCircle, iconColor: 'brand' },
    { label: 'Pro', value: userStats?.pro ?? '—', icon: CheckCircle, iconColor: 'cyan' },
    { label: 'Agency', value: userStats?.agency ?? '—', icon: CheckCircle, iconColor: 'rose' },
    {
      label: 'Coupon Uses',
      value: couponStats?.totalUses ?? '—',
      icon: MousePointerClick,
      iconColor: 'emerald',
    },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-display font-bold text-white text-2xl">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">TubeOS platform overview</p>
      </div>

      {/* User Stats */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Users</p>
        <div className="grid grid-cols-4 gap-4">
          {userMetrics.map((m) => (
            <MetricCard key={m.label} {...m} loading={loading} />
          ))}
        </div>
      </div>

      {/* Plan Breakdown */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Plan Breakdown
        </p>
        <div className="grid grid-cols-4 gap-4">
          {planMetrics.map((m) => (
            <MetricCard key={m.label} {...m} loading={loading} />
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="glass p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Quick Actions
        </p>
        <div className="flex gap-3">
          <Link
            to="/admin/users"
            className="flex items-center gap-2 px-4 py-2 bg-brand/10 border border-brand/20 rounded-lg text-brand text-sm hover:bg-brand/20 transition-colors"
          >
            <Users size={14} /> Manage Users
          </Link>
          <Link
            to="/admin/coupons"
            className="flex items-center gap-2 px-4 py-2 bg-cyan/10 border border-cyan/20 rounded-lg text-cyan text-sm hover:bg-cyan/20 transition-colors"
          >
            <Tag size={14} /> Manage Coupons
          </Link>
        </div>
      </div>
    </div>
  )
}
