// src/pages/settings/Settings.jsx
import { useState } from 'react'
import { User, Lock, Bell, CreditCard, Shield, ChevronRight, Check } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth.api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { PlanBadge } from '../../components/ui/Badge'
import { PLANS } from '../../utils/constants'
import { formatNumber } from '../../utils/formatters'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'password', label: 'Password', icon: Lock },
  { key: 'plan', label: 'Plan & Billing', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', icon: Bell },
]

const UsageBar = ({ label, used, limit }) => {
  const isUnlimited = limit === -1
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const isHigh = pct >= 80

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`text-xs font-medium ${isHigh ? 'text-rose' : 'text-gray-400'}`}>
          {isUnlimited ? '∞ Unlimited' : `${formatNumber(used)} / ${formatNumber(limit)}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500
                        ${isHigh ? 'bg-rose' : 'bg-brand-gradient'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export const Settings = () => {
  const { user, updateUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')

  // Profile state
  const [name, setName] = useState(user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password state
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [savingPassword, setSavingPassword] = useState(false)

  // Notifications state
  const [notifications, setNotifications] = useState({
    weeklyReport: true,
    dailyReport: false,
    spikeAlert: true,
    scheduledPost: true,
    commentReply: false,
  })

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSavingProfile(true)
    try {
      const res = await authApi.updateMe({ name })
      updateUser({ name })
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new) {
      toast.error('Fill all fields')
      return
    }
    if (passwords.new.length < 8) {
      toast.error('New password min 8 characters')
      return
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('Passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      await authApi.changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.new,
      })
      setPasswords({ current: '', new: '', confirm: '' })
      toast.success('Password changed!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const plan = user?.plan || 'free'
  const planConfig = PLANS[plan]
  const usage = user?.usage || {}

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Tab nav */}
      <div className="flex items-center glass rounded-xl p-1 overflow-x-auto no-scrollbar">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                        whitespace-nowrap transition-all
                        ${activeTab === key
                          ? 'bg-brand text-white'
                          : 'text-gray-400 hover:text-white'}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <Card>
          <CardHeader title="Profile Settings" icon={User} />
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 glass rounded-xl mb-2">
              <div className="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center
                              text-white font-bold text-xl font-display shrink-0">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-white">{user?.name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <div className="mt-1">
                  <PlanBadge plan={plan} />
                </div>
              </div>
            </div>

            <Input
              label="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
            <Input
              label="Email"
              value={user?.email || ''}
              disabled
              hint="Email cannot be changed"
            />

            <Button onClick={handleSaveProfile} loading={savingProfile}>
              Save Changes
            </Button>
          </div>
        </Card>
      )}

      {/* Password */}
      {activeTab === 'password' && (
        <Card>
          <CardHeader title="Change Password" icon={Lock} />
          <div className="space-y-4">
            {[
              { key: 'current', label: 'Current Password' },
              { key: 'new', label: 'New Password' },
              { key: 'confirm', label: 'Confirm New Password' },
            ].map(({ key, label }) => (
              <Input
                key={key}
                label={label}
                type="password"
                value={passwords[key]}
                onChange={e => setPasswords(p => ({ ...p, [key]: e.target.value }))}
                placeholder="••••••••"
              />
            ))}
            <Button onClick={handleChangePassword} loading={savingPassword}>
              Change Password
            </Button>
          </div>
        </Card>
      )}

      {/* Plan & Billing */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Current Plan" icon={CreditCard} />
            <div className="flex items-center justify-between p-4 glass rounded-xl mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-display font-bold text-white text-xl capitalize">{plan} Plan</p>
                  <PlanBadge plan={plan} />
                </div>
                <p className="text-sm text-gray-500">
                  {plan === 'free'
                    ? 'Free forever'
                    : `₹${planConfig?.price?.inr}/month`}
                </p>
              </div>
              {plan !== 'agency' && (
                <Button size="sm" onClick={() => toast('Payment integration coming soon!')}>
                  Upgrade
                </Button>
              )}
            </div>

            {/* Usage bars */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                This Month's Usage
              </p>
              <UsageBar
                label="AI Replies"
                used={usage.aiRepliesUsed || 0}
                limit={planConfig?.aiReplies || 0}
              />
              <UsageBar
                label="Video Uploads"
                used={usage.uploadsUsed || 0}
                limit={planConfig?.uploads === 0 ? 0 : planConfig?.uploads || 0}
              />
            </div>
          </Card>

          {/* Upgrade CTA */}
          {plan !== 'agency' && (
            <Card>
              <CardHeader title="Upgrade Your Plan" icon={CreditCard} iconColor="amber" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(PLANS)
                  .filter(([key]) => key !== 'free' && key !== plan)
                  .map(([key, config]) => (
                    <div
                      key={key}
                      className={`p-4 rounded-xl border transition-all cursor-pointer
                                  ${key === 'pro'
                                    ? 'border-brand/40 bg-brand/5'
                                    : 'glass hover:border-white/20'}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-display font-bold text-white capitalize">{key}</p>
                        {key === 'pro' && (
                          <span className="text-2xs text-brand bg-brand/15 px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-display font-bold text-white mb-1">
                        ₹{config.price.inr}
                        <span className="text-sm text-gray-500 font-normal">/mo</span>
                      </p>
                      <div className="space-y-1.5 mt-3">
                        {[
                          `${config.channels} channel${config.channels > 1 ? 's' : ''}`,
                          `${config.aiReplies === -1 ? 'Unlimited' : config.aiReplies} AI replies`,
                          `${config.uploads === -1 ? 'Unlimited' : config.uploads} uploads/mo`,
                        ].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs text-gray-400">
                            <Check size={11} className="text-emerald" />
                            {f}
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        fullWidth
                        className="mt-4"
                        variant={key === 'pro' ? 'brand' : 'ghost'}
                        onClick={() => toast('Payment integration coming soon!')}
                      >
                        Upgrade
                      </Button>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader title="Notification Preferences" icon={Bell} />
          <div className="space-y-4">
            {[
              { key: 'weeklyReport', label: 'Weekly Performance Report', desc: 'Every Monday morning' },
              { key: 'dailyReport', label: 'Daily Stats Digest', desc: 'Every day at 9 AM' },
              { key: 'spikeAlert', label: 'Traffic Spike Alert', desc: 'When a video goes viral' },
              { key: 'scheduledPost', label: 'Scheduled Post Published', desc: 'When video goes live' },
              { key: 'commentReply', label: 'New Comments', desc: 'When viewers comment' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                <button
                  onClick={() => setNotifications(p => ({ ...p, [key]: !p[key] }))}
                  className={`w-11 h-6 rounded-full transition-all relative shrink-0
                              ${notifications[key] ? 'bg-brand' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all
                                    ${notifications[key] ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
            <Button onClick={() => toast.success('Preferences saved!')} className="mt-2">
              Save Preferences
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
