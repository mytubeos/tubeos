// src/pages/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react'
import { Tag, CheckCircle, XCircle, MousePointerClick, Lock, Globe } from 'lucide-react'
import { MetricCard } from '../../components/ui/Card'
import adminAPI from '../../api/admin.api'

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.getCouponStats()
      .then(r => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const metrics = [
    { label: 'Total Coupons',   value: stats?.total ?? '—',      icon: Tag,              iconColor: 'brand' },
    { label: 'Active',          value: stats?.active ?? '—',     icon: CheckCircle,       iconColor: 'emerald' },
    { label: 'Inactive',        value: stats?.inactive ?? '—',   icon: XCircle,           iconColor: 'rose' },
    { label: 'Total Uses',      value: stats?.totalUses ?? '—',  icon: MousePointerClick, iconColor: 'cyan' },
    { label: 'Internal Codes',  value: stats?.internal ?? '—',   icon: Lock,              iconColor: 'amber' },
    { label: 'Public Codes',    value: stats?.public ?? '—',     icon: Globe,             iconColor: 'brand' },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-white text-2xl">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your coupon system</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} loading={loading} />
        ))}
      </div>

      {/* Quick links */}
      <div className="mt-8 glass p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Quick Actions</p>
        <div className="flex gap-3">
          <a href="/admin/coupons" className="flex items-center gap-2 px-4 py-2 bg-brand/10 border border-brand/20
                                              rounded-lg text-brand text-sm hover:bg-brand/20 transition-colors">
            <Tag size={14} /> Manage Coupons
          </a>
        </div>
      </div>
    </div>
  )
}
